'use strict';

const path = require('path');
const { Files } = require('vscode-languageserver/node');
const { URI } = require('vscode-uri');
const { getWorkspaceFolder } = require('../documents');
const { getGlobalPathResolver } = require('./global-path-resolver');

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
	 * @private
	 * @param {string} message The message to log.
	 * @param {boolean} showMessage Whether to show the message to the user in a notification.
	 * @returns {void}
	 */
	#logError(message, showMessage = true) {
		if (!this.#connection) {
			return;
		}

		if (showMessage) {
			this.#connection.window.showErrorMessage(`stylelint: ${message}`);
		}

		this.#connection.console.error(message);
	}

	/**
	 * Attempts to resolve the stylelint package from a path. If an error
	 * occurs, it will be logged through the connection and thrown. If the
	 * resolved module does not have a lint function, an error will be logged
	 * and `undefined` will be returned.
	 * @private
	 * @param {string} stylelintPath
	 * @returns {stylelint.PublicApi | undefined}
	 */
	#resolveFromPath(stylelintPath) {
		const errorMessage = `Failed to load stylelint from "stylelintPath": ${stylelintPath}.`;

		let stylelint;

		try {
			stylelint = require(stylelintPath);
		} catch (err) {
			this.#logError(errorMessage);
			throw err;
		}

		if (stylelint && typeof stylelint.lint === 'function') {
			return stylelint;
		}

		this.#logError(errorMessage);

		return undefined;
	}

	/**
	 * Attempts to resolve the stylelint package from the given document's
	 * workspace folder or the global `node_modules` directory for the given
	 * package manager. Resolution will be traced through the connection.
	 *
	 * If a path cannot be resolved, `undefined` will be returned. If the
	 * resolved module does not have a lint function, an error will be logged
	 * and `undefined` will be returned.
	 * @private
	 * @param {lsp.TextDocument} textDocument
	 * @param {PackageManager} [packageManager]
	 * @returns {Promise<stylelint.PublicApi | undefined>}
	 */
	async #resolveFromModules(textDocument, packageManager) {
		const connection = this.#connection;

		/** @type {TracerFn} */
		const trace = connection
			? (message, verbose) => {
					this.#logger?.debug(message, { verbose });
					connection.tracer.log(message, verbose);
			  }
			: () => undefined;

		/** @type {stylelint.PublicApi | undefined} */
		let stylelint;

		try {
			/** @type {string | undefined} */
			const globalModulesPath = packageManager
				? await this.#globalPathResolver.resolve(packageManager, trace)
				: undefined;

			const documentURI = URI.parse(textDocument.uri);

			const cwd =
				documentURI.scheme === 'file'
					? path.dirname(documentURI.fsPath)
					: connection && (await getWorkspaceFolder(connection, textDocument));

			const stylelintPath = await Files.resolve('stylelint', globalModulesPath, cwd, trace);

			stylelint = require(stylelintPath);

			if (stylelint && typeof stylelint.lint !== 'function') {
				this.#logError('stylelint.lint is not a function.');

				return undefined;
			}
		} catch {
			// ignore
		}

		return stylelint;
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
	 * @returns {Promise<stylelint.PublicApi | undefined>}
	 */
	async resolve({ packageManager, stylelintPath }, textDocument) {
		const stylelint =
			(stylelintPath ? this.#resolveFromPath(stylelintPath) : null) ??
			(await this.#resolveFromModules(textDocument, packageManager));

		if (!stylelint) {
			this.#logError(
				'Failed to load stylelint either globally or from the current workspace.',
				false,
			);

			return undefined;
		}

		return stylelint;
	}
}

module.exports = {
	StylelintResolver,
};
