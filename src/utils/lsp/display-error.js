'use strict';

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

	if (/** @type {InvalidOptionError} */ (err)?.reasons) {
		for (const reason of /** @type {InvalidOptionError} */ (err)?.reasons) {
			connection.window.showErrorMessage(`stylelint: ${reason}`);
		}

		return;
	}

	// https://github.com/stylelint/stylelint/blob/551dcb5/lib/utils/configurationError.js#L12
	if (/** @type {ConfigurationError} */ (err)?.code === 78) {
		connection.window.showErrorMessage(`stylelint: ${err.message}`);

		return;
	}

	connection.window.showErrorMessage((err.stack || err.message).replace(/\n/gu, ' '));
}

module.exports = {
	displayError,
};
