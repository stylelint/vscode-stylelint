// @no-unit-test -- This is an entry point that cannot feasibly be unit tested.

import path from 'node:path';
import process from 'node:process';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { StylelintLanguageServer } from '../server/index.js';
import { parseLogLevel } from '../shared/log-level.js';

const connection = createConnection(ProposedFeatures.all);

const isDevelopment = process.env.NODE_ENV === 'development';
const configuredLogLevel = parseLogLevel(process.env.STYLELINT_LOG_LEVEL);

const server = new StylelintLanguageServer({
	connection,
	logLevel: configuredLogLevel ?? (isDevelopment ? 'debug' : 'info'),
	logPath: isDevelopment ? path.join(__dirname, '../stylelint-language-server.log') : undefined,
});

const reportStartupError = (error: unknown): void => {
	const message = error instanceof Error ? (error.stack ?? error.message) : String(error);

	try {
		connection.console.error(`Stylelint language server failed to start: ${message}`);
	} catch {
		// ignore
	}

	try {
		process.stderr.write(`Stylelint language server failed to start: ${message}\n`);
	} catch {
		// ignore
	}
};

void (async () => {
	try {
		await server.start();
	} catch (error) {
		reportStartupError(error);

		try {
			await server.dispose();
		} catch {
			// ignore
		}

		try {
			connection.dispose();
		} catch {
			// ignore
		}

		// Be extra extra sure we don't leave a half-started process hanging
		// around with open listeners, even though we tried to clean up above.
		// Process will exit with non-zero code due to the unhandled rejection.
		throw error instanceof Error
			? error
			: new Error(`Stylelint language server failed to start: ${String(error)}`);
	}
})();
