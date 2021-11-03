'use strict';

const { isIterableObject } = require('../iterables');

/**
 * Takes an error and displays it in the UI using the given connection.
 * @param {lsp.Connection} connection The language server connection.
 * @param {unknown} err
 * @returns {void}
 */
function displayError(connection, err) {
	if (!(err instanceof Error)) {
		connection.window.showErrorMessage(String(err).replace(/\n/gu, ' '));

		return;
	}

	if (isIterableObject(/** @type {InvalidOptionError} */ (err)?.reasons)) {
		for (const reason of /** @type {InvalidOptionError} */ (err).reasons) {
			connection.window.showErrorMessage(`Stylelint: ${reason}`);
		}

		return;
	}

	// https://github.com/stylelint/stylelint/blob/551dcb5/lib/utils/configurationError.js#L12
	if (/** @type {ConfigurationError} */ (err)?.code === 78) {
		connection.window.showErrorMessage(`Stylelint: ${err.message}`);

		return;
	}

	connection.window.showErrorMessage((err.stack || err.message).replace(/\n/gu, ' '));
}

module.exports = {
	displayError,
};
