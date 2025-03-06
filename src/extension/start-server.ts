import path from 'path';
import process from 'process';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { StylelintLanguageServer, modules, createLogger } from '../server/index';

const connection = createConnection(ProposedFeatures.all);

const { NODE_ENV } = process.env;

const logger =
	NODE_ENV === 'development'
		? createLogger(connection, 'debug', path.join(__dirname, '../stylelint-language-server.log'))
		: createLogger(connection, 'info');

const server = new StylelintLanguageServer({
	connection,
	logger,
	modules: Object.values(modules),
});

server.start();
