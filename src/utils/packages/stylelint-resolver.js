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
	 * @param {lsp.Connection} [connection] The language server connection.
	 */
	constructor(connection) {
		this._globalPathResolver = getGlobalPathResolver();
		this._connection = connection;
	}

	/**
	 * Logs an error message through the connection if one is available.
	 * @private
	 * @param {string} message The message to log.
	 * @param {boolean} showMessage Whether to show the message to the user in a notification.
	 * @returns {void}
	 */
	_logError(message, showMessage = true) {
		if (!this._connection) {
			return;
		}

		if (showMessage) {
			this._connection.window.showErrorMessage(`stylelint: ${message}`);
		}

		this._connection.console.error(message);
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
	_resolveFromPath(stylelintPath) {
		const errorMessage = `Failed to load stylelint from "stylelintPath": ${stylelintPath}.`;

		let stylelint;

		try {
			stylelint = require(stylelintPath);
		} catch (err) {
			this._logError(errorMessage);
			throw err;
		}

		if (stylelint && typeof stylelint.lint === 'function') {
			return stylelint;
		}

		this._logError(errorMessage);

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
	async _resolveFromModules(textDocument, packageManager) {
		const connection = this._connection;

		/** @type {TracerFn} */
		const trace = connection
			? (message, verbose) => {
					connection.tracer.log(message, verbose);
			  }
			: () => undefined;

		/** @type {stylelint.PublicApi | undefined} */
		let stylelint;

		try {
			/** @type {string | undefined} */
			const globalModulesPath = packageManager
				? await this._globalPathResolver.resolve(packageManager, trace)
				: undefined;

			const documentURI = URI.parse(textDocument.uri);

			const cwd =
				documentURI.scheme === 'file'
					? path.dirname(documentURI.fsPath)
					: await getWorkspaceFolder(textDocument, connection);

			const stylelintPath = await Files.resolve('stylelint', globalModulesPath, cwd, trace);

			stylelint = require(stylelintPath);

			if (stylelint && typeof stylelint.lint !== 'function') {
				this._logError('stylelint.lint is not a function.');

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
	 * @param {StylelintVSCodeOptions} options
	 * @param {lsp.TextDocument} textDocument
	 * @returns {Promise<stylelint.PublicApi | undefined>}
	 */
	async resolve({ packageManager, stylelintPath }, textDocument) {
		const stylelint =
			(stylelintPath ? this._resolveFromPath(stylelintPath) : null) ??
			(await this._resolveFromModules(textDocument, packageManager));

		if (!stylelint) {
			this._logError(
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
