// @no-unit-test -- This is an entry point that cannot feasibly be unit tested.

import path from 'node:path';
import process from 'node:process';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { StylelintLanguageServer } from '../server/index.js';

const connection = createConnection(ProposedFeatures.all);

const isDevelopment = process.env.NODE_ENV === 'development';

const server = new StylelintLanguageServer({
	connection,
	logLevel: isDevelopment ? 'debug' : 'info',
	logPath: isDevelopment ? path.join(__dirname, '../stylelint-language-server.log') : undefined,
});

void server.start();
