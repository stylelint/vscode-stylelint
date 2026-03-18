#!/usr/bin/env node

import process from 'process';
import { createConnection, ProposedFeatures } from 'vscode-languageserver';
import { StylelintLanguageServer } from '../build/server/index.js';

const connection = createConnection(ProposedFeatures.all);

const server = new StylelintLanguageServer({
	connection,
	logLevel: process.env.STYLELINT_LOG_LEVEL || 'info',
});

server.start().catch((error) => {
	const message = error instanceof Error ? error.stack || error.message : String(error);

	try {
		connection.console.error(`Stylelint language server failed to start: ${message}`);
	} catch {
		// ignore
	}

	process.stderr.write(`Stylelint language server failed to start: ${message}\n`);
	process.exitCode = 1;
});
