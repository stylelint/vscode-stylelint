'use strict';

const path = require('path');
const fs = require('fs/promises');
const { Files } = require('vscode-languageserver/node');
const { URI } = require('vscode-uri');
const { getWorkspaceFolder } = require('../documents');
const { findPackageRoot } = require('./find-package-root');
const { getGlobalPathResolver } = require('./global-path-resolver');
const { getFirstResolvedValue, lazyCallAsync } = require('../functions');
const { createRequire } = require('module');
const process = require('process');

/**
 * Utility for resolving the path to the Stylelint package. Each instance caches
 * resolved paths to global `node_modules` directories.
 */
class StylelintResolver {
	/**
	 * The language server connection.
	 * @type {lsp.Connection | undefined}
	 */
	#connection;

	/**
	 * The logger to use, if any.
	 * @type {winston.Logger | undefined}
	 */
	#logger;

	/**
	 * The global path resolver.
	 * @type {GlobalPathResolver}
	 */
	#globalPathResolver;

	/**
	 * @param {lsp.Connection} [connection] The language server connection.
	 * @param {winston.Logger} [logger] The logger to use.
	 */
	constructor(connection, logger) {
		this.#connection = connection;
		this.#logger = logger;
		this.#globalPathResolver = getGlobalPathResolver();
	}

	/**
	 * Logs an error message through the connection if one is available.
	 * @param {string} message The message to log.
	 * @param {unknown} [error] The error to log.
	 * @returns {void}
	 */
	#logError(message, error) {
		if (this.#logger) {
			this.#logger?.error(message, error && { error });
		}

		if (this.#connection) {
			this.#connection.window.showErrorMessage(`Stylelint: ${message}`);
		}
	}

	/**
	 * Tries to find the PnP loader in the given directory. If the loader cannot
	 * be found, `undefined` will be returned.
	 * @param {string} directory
	 * @returns {Promise<string | undefined>}
	 */
	async #findPnPLoader(directory) {
		const pnpFilenames = ['.pnp.cjs', '.pnp.js'];

		for (const filename of pnpFilenames) {
			const pnpPath = path.join(directory, filename);

			try {
				if ((await fs.stat(pnpPath)).isFile()) {
					return pnpPath;
				}
			} catch (error) {
				this.#logger?.debug('Did not find PnP loader at tested path', { path: pnpPath, error });
			}
		}

		this.#logger?.debug('Could not find a PnP loader', { path: directory });

		return undefined;
	}

	/**
	 * Tries to resolve the Stylelint package using Plug-n-Play. If the package
	 * cannot be resolved, `undefined` will be returned.
	 * @param {string | undefined} cwd
	 * @returns {Promise<StylelintResolutionResult | undefined>}
	 */
	async #requirePnP(cwd) {
		if (!cwd) {
			return undefined;
		}

		const root = await findPackageRoot(cwd, 'yarn.lock');

		if (!root) {
			this.#logger?.debug('Could not find the package root', { cwd });

			return undefined;
		}

		const pnpPath = await this.#findPnPLoader(root);

		if (!pnpPath) {
			return undefined;
		}

		if (!process.versions.pnp) {
			try {
				require(pnpPath).setup();
			} catch (error) {
				this.#logger?.warn('Could not setup PnP', { path: pnpPath, error });

				return undefined;
			}
		}

		try {
			const rootRelativeRequire = createRequire(pnpPath);

			const stylelintEntryPath = rootRelativeRequire.resolve('stylelint');
			const stylelintPath = await findPackageRoot(stylelintEntryPath);

			if (!stylelintPath) {
				this.#logger?.warn('Failed to find the Stylelint package root', {
					path: stylelintEntryPath,
				});

				return undefined;
			}

			const stylelint = rootRelativeRequire('stylelint');

			const result = {
				stylelint,
				resolvedPath: stylelintPath,
			};

			this.#logger?.debug('Resolved Stylelint using PnP', {
				path: pnpPath,
			});

			return result;
		} catch (error) {
			this.#logger?.warn('Could not load Stylelint using PnP', { path: root, error });

			return undefined;
		}
	}

	/**
	 * Tries to resolve the Stylelint package from `node_modules`. If the
	 * package cannot be resolved, `undefined` will be returned.
	 * @param {string | undefined} cwd
	 * @param {string | undefined} globalModulesPath
	 * @param {TracerFn} trace
	 * @returns {Promise<StylelintResolutionResult | undefined>}
	 */
	async #requireNode(cwd, globalModulesPath, trace) {
		try {
			const stylelintPath = await Files.resolve('stylelint', globalModulesPath, cwd, trace);

			const result = {
				stylelint: require(stylelintPath),
				resolvedPath: stylelintPath,
			};

			this.#logger?.debug('Resolved Stylelint from node_modules', {
				path: stylelintPath,
			});

			return result;
		} catch (error) {
			this.#logger?.warn('Could not load Stylelint from node_modules', { error });

			return undefined;
		}
	}

	/**
	 * If the given path is absolute, returns it. Otherwise, if a connection is
	 * available, returns the path resolved to the document's workspace folder.
	 * If no connection is available, returns the path as-is.
	 * @param {string} stylelintPath
	 * @param {() => Promise<string | undefined>} getWorkspaceFolderFn
	 */
	async #getRequirePath(stylelintPath, getWorkspaceFolderFn) {
		if (!this.#connection || path.isAbsolute(stylelintPath)) {
			return stylelintPath;
		}

		const workspaceFolder = await getWorkspaceFolderFn();

		return workspaceFolder ? path.join(workspaceFolder, stylelintPath) : stylelintPath;
	}

	/**
	 * Attempts to resolve the Stylelint package from a path. If an error
	 * occurs, it will be logged through the connection and thrown. If the
	 * resolved module does not have a lint function, an error will be logged
	 * and `undefined` will be returned.
	 * @param {string | undefined} stylelintPath
	 * @param {() => Promise<string | undefined>} getWorkspaceFolderFn
	 * @returns {Promise<StylelintResolutionResult | undefined>}
	 */
	async #resolveFromPath(stylelintPath, getWorkspaceFolderFn) {
		if (!stylelintPath) {
			return undefined;
		}

		const errorMessage = `Failed to load Stylelint from "stylelintPath": ${stylelintPath}.`;

		try {
			const requirePath = await this.#getRequirePath(stylelintPath, getWorkspaceFolderFn);

			const stylelint = require(requirePath);

			if (stylelint && typeof stylelint.lint === 'function') {
				return {
					stylelint,
					resolvedPath: requirePath,
				};
			}
		} catch (err) {
			this.#logError(errorMessage, err);

			throw err;
		}

		this.#logError(errorMessage);

		return undefined;
	}

	/**
	 * Attempts to resolve the Stylelint package from the given document's
	 * workspace folder or the global `node_modules` directory for the given
	 * package manager. Resolution will be traced through the connection.
	 *
	 * If a path cannot be resolved, `undefined` will be returned. If the
	 * resolved module does not have a lint function, an error will be logged
	 * and `undefined` will be returned.
	 * @private
	 * @param {lsp.TextDocument} textDocument
	 * @param {() => Promise<string | undefined>} getWorkspaceFolderFn
	 * @param {PackageManager} [packageManager]
	 * @returns {Promise<StylelintResolutionResult | undefined>}
	 */
	async #resolveFromModules(textDocument, getWorkspaceFolderFn, packageManager) {
		const connection = this.#connection;

		/** @type {TracerFn} */
		const trace = (message, verbose) => {
			this.#logger?.debug(message, { verbose });
			connection?.tracer.log(message, verbose);
		};

		try {
			/** @type {string | undefined} */
			const globalModulesPath = packageManager
				? await this.#globalPathResolver.resolve(packageManager, trace)
				: undefined;

			const documentURI = URI.parse(textDocument.uri);

			const cwd =
				documentURI.scheme === 'file'
					? path.dirname(documentURI.fsPath)
					: await getWorkspaceFolderFn();

			const result = await getFirstResolvedValue(
				async () => await this.#requirePnP(cwd),
				async () => await this.#requireNode(cwd, globalModulesPath, trace),
			);

			if (!result) {
				return undefined;
			}

			if (typeof result.stylelint?.lint !== 'function') {
				this.#logError('stylelint.lint is not a function.');

				return undefined;
			}

			return result;
		} catch {
			// ignore
		}

		return undefined;
	}

	/**
	 * Attempts to resolve the `stylelint` package from the following locations,
	 * in order:
	 *
	 * 1. `options.stylelintPath`, if provided.
	 * 2. `node_modules` in the workspace folder of the given document.
	 * 3. The global `node_modules` directory for the given package manager.
	 *
	 * If `options.stylelintPath` is provided, but the path to which it points
	 * cannot be required, an error will be thrown. In all other cases of failed
	 * resolution, `undefined` will be returned. Resolution fails if either the
	 * path to the `stylelint` package cannot be resolved or if the resolved
	 * module does not have a `lint` function.
	 *
	 * If a connection is available, errors will be logged through it and module
	 * resolution through `node_modules` will be traced through it.
	 * @param {ResolverOptions} options
	 * @param {lsp.TextDocument} textDocument
	 * @returns {Promise<StylelintResolutionResult | undefined>}
	 */
	async resolve({ packageManager, stylelintPath }, textDocument) {
		const getWorkspaceFolderFn = lazyCallAsync(
			async () => this.#connection && (await getWorkspaceFolder(this.#connection, textDocument)),
		);

		const stylelint = await getFirstResolvedValue(
			() => this.#resolveFromPath(stylelintPath, getWorkspaceFolderFn),
			() => this.#resolveFromModules(textDocument, getWorkspaceFolderFn, packageManager),
		);

		if (!stylelint) {
			this.#logger?.warn('Failed to load Stylelint either globally or from the current workspace.');

			return undefined;
		}

		return stylelint;
	}
}

module.exports = {
	StylelintResolver,
};
