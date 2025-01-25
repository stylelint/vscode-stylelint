import fs from 'fs/promises';
import { createRequire } from 'module';
import path from 'path';
import process from 'process';

import type winston from 'winston';
// eslint-disable-next-line n/no-missing-import
import { Connection, Files } from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import type { TextDocument } from 'vscode-languageserver-textdocument';

import { getWorkspaceFolder } from '../documents/index';
import { findPackageRoot } from './find-package-root';
import { GlobalPathResolver } from './global-path-resolver';
import { getFirstResolvedValue, lazyCallAsync } from '../functions/index';
import type { PackageManager, StylelintResolutionResult, ResolverOptions, TracerFn } from './types';
import { Stylelint } from '../stylelint/index';

/**
 * Utility for resolving the path to the Stylelint package. Each instance caches
 * resolved paths to global `node_modules` directories.
 */
export class StylelintResolver {
	/**
	 * The language server connection.
	 */
	#connection: Connection | undefined;

	/**
	 * The logger to use, if any.
	 */
	#logger: winston.Logger | undefined;

	/**
	 * The global path resolver.
	 */
	#globalPathResolver: GlobalPathResolver;

	/**
	 * @param connection The language server connection.
	 * @param logger The logger to use.
	 */
	constructor(connection?: Connection, logger?: winston.Logger) {
		this.#connection = connection;
		this.#logger = logger;
		this.#globalPathResolver = new GlobalPathResolver(logger);
	}

	/**
	 * Logs an error message through the connection if one is available.
	 * @param message The message to log.
	 * @param error The error to log.
	 */
	#logError(message: string, error?: unknown): void {
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
	 */
	async #findPnPLoader(directory: string): Promise<string | undefined> {
		const pnpFilenames = ['.pnp.cjs', '.pnp.js'];

		for (const filename of pnpFilenames) {
			const pnpPath = path.join(directory, filename);

			try {
				if ((await fs.stat(pnpPath)).isFile()) {
					return pnpPath;
				}
			} catch (error) {
				this.#logger?.debug('Did not find PnP loader at tested path', {
					path: pnpPath,
					error,
				});
			}
		}

		this.#logger?.debug('Could not find a PnP loader', { path: directory });

		return undefined;
	}

	/**
	 * Tries to resolve the Stylelint package using Plug-n-Play. If the package
	 * cannot be resolved, `undefined` will be returned.
	 */
	async #requirePnP(cwd: string | undefined): Promise<StylelintResolutionResult | undefined> {
		if (!cwd) {
			return undefined;
		}

		const root = await findPackageRoot(cwd, 'yarn.lock');

		if (!root) {
			this.#logger?.debug('Could not find a Yarn lockfile', { cwd });

			return undefined;
		}

		const pnpPath = await this.#findPnPLoader(root);

		if (!pnpPath) {
			return undefined;
		}

		if (!process.versions.pnp) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				(require(pnpPath) as { setup: () => void }).setup();
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

			const stylelint = rootRelativeRequire('stylelint') as Stylelint;

			const result = {
				stylelint,
				resolvedPath: stylelintPath,
			};

			this.#logger?.debug('Resolved Stylelint using PnP', {
				path: pnpPath,
			});

			return result;
		} catch (error) {
			this.#logger?.warn('Could not load Stylelint using PnP', {
				path: root,
				error,
			});

			return undefined;
		}
	}

	/**
	 * Tries to resolve the Stylelint package from `node_modules`. If the
	 * package cannot be resolved, `undefined` will be returned.
	 */
	async #requireNode(
		cwd: string | undefined,
		globalModulesPath: string | undefined,
		trace: TracerFn,
	): Promise<StylelintResolutionResult | undefined> {
		try {
			const stylelintPath = await Files.resolve('stylelint', globalModulesPath, cwd, trace);

			const result = {
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				stylelint: require(stylelintPath) as Stylelint,
				resolvedPath: stylelintPath,
			};

			this.#logger?.debug('Resolved Stylelint from node_modules', {
				path: stylelintPath,
			});

			return result;
		} catch (error) {
			this.#logger?.warn('Could not load Stylelint from node_modules', {
				error,
			});

			return undefined;
		}
	}

	/**
	 * If the given path is absolute, returns it. Otherwise, if a connection is
	 * available, returns the path resolved to the document's workspace folder.
	 * If no connection is available, returns the path as-is.
	 */
	async #getRequirePath(
		stylelintPath: string,
		getWorkspaceFolderFn: () => Promise<string | undefined>,
	): Promise<string> {
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
	 */
	async #resolveFromPath(
		stylelintPath: string | undefined,
		getWorkspaceFolderFn: () => Promise<string | undefined>,
	): Promise<StylelintResolutionResult | undefined> {
		if (!stylelintPath) {
			return undefined;
		}

		const errorMessage = `Failed to load Stylelint from "stylelintPath": ${stylelintPath}.`;

		try {
			const requirePath = await this.#getRequirePath(stylelintPath, getWorkspaceFolderFn);

			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const stylelint = require(requirePath) as Stylelint;

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
	 */
	async #resolveFromModules(
		textDocument: TextDocument,
		getWorkspaceFolderFn: () => Promise<string | undefined>,
		packageManager?: PackageManager,
	): Promise<StylelintResolutionResult | undefined> {
		const connection = this.#connection;

		try {
			const globalModulesPath = packageManager
				? await this.#globalPathResolver.resolve(packageManager)
				: undefined;

			const documentURI = URI.parse(textDocument.uri);

			const cwd =
				documentURI.scheme === 'file'
					? path.dirname(documentURI.fsPath)
					: await getWorkspaceFolderFn();

			const result = await getFirstResolvedValue(
				async () => await this.#requirePnP(cwd),
				async () =>
					await this.#requireNode(cwd, globalModulesPath, (message, verbose) => {
						this.#logger?.debug(message.replace(/\n/g, '  '), { verbose });
						connection?.tracer.log(message, verbose);
					}),
			);

			if (!result) {
				return undefined;
			}

			if (typeof result.stylelint?.lint !== 'function') {
				this.#logError('stylelint.lint is not a function.');

				return undefined;
			}

			return result;
		} catch (error) {
			this.#logger?.debug(
				'Failed to resolve Stylelint from workspace or globally-installed packages.',
				{ error },
			);
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
	 * @param {TextDocument} textDocument
	 * @returns {Promise<StylelintResolutionResult | undefined>}
	 */
	async resolve(
		{ packageManager, stylelintPath }: ResolverOptions,
		textDocument: TextDocument,
	): Promise<StylelintResolutionResult | undefined> {
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
