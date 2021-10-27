'use strict';

const path = require('path');
const { Files } = require('vscode-languageserver/node');
const { URI } = require('vscode-uri');
const { getWorkspaceFolder } = require('../documents');
const { getGlobalPathResolver } = require('./global-path-resolver');
const { getFirstResolvedValue, lazyCallAsync } = require('../../utils/functions');

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
	 * @returns {void}
	 */
	#logError(message) {
		if (!this.#connection) {
			return;
		}

		this.#connection.window.showErrorMessage(`Stylelint: ${message}`);
		this.#logger?.error(message);
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
			this.#logError(errorMessage);

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
		const trace = connection
			? (message, verbose) => {
					this.#logger?.debug(message, { verbose });
					connection.tracer.log(message, verbose);
			  }
			: () => undefined;

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

			const stylelintPath = await Files.resolve('stylelint', globalModulesPath, cwd, trace);

			const stylelint = require(stylelintPath);

			if (stylelint && typeof stylelint.lint !== 'function') {
				this.#logError('stylelint.lint is not a function.');

				return undefined;
			}

			return {
				stylelint,
				resolvedPath: stylelintPath,
			};
		} catch {
			// ignore
		}

		return undefined;
	}

	/**
	 * Attempts to resolve the `stylelint` package from the following lcoations,
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
			async () => this.#resolveFromPath(stylelintPath, getWorkspaceFolderFn),
			async () =>
				await this.#resolveFromModules(textDocument, getWorkspaceFolderFn, packageManager),
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
