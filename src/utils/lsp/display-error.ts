import { isIterableObject } from '../iterables';
import type { Connection } from 'vscode-languageserver';
import type { InvalidOptionError, ConfigurationError } from '../stylelint/index';

/**
 * Takes an error and displays it in the UI using the given connection.
 * @param connection The language server connection.
 * @param err
 */
export function displayError(connection: Connection, err: unknown): void {
	if (!(err instanceof Error)) {
		connection.window.showErrorMessage(String(err).replace(/\n/gu, ' '));

		return;
	}

	if (isIterableObject((err as InvalidOptionError)?.reasons)) {
		for (const reason of (err as InvalidOptionError).reasons) {
			connection.window.showErrorMessage(`Stylelint: ${reason}`);
		}

		return;
	}

	if ((err as ConfigurationError)?.code === 78) {
		connection.window.showErrorMessage(`Stylelint: ${err.message}`);

		return;
	}

	connection.window.showErrorMessage((err.stack || err.message).replace(/\n/gu, ' '));
}
