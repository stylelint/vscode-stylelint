import path from 'path';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import winston from 'winston';
import { StylelintLanguageServer, modules } from '../server';

const connection = createConnection(ProposedFeatures.all);

import { ErrorFormatter, LanguageServerTransport, LanguageServerFormatter } from '../utils/logging';

const { NODE_ENV } = process.env;

const level = NODE_ENV === 'development' ? 'debug' : 'info';

const transports: winston.transport[] = [
	new LanguageServerTransport({
		connection,
		format: winston.format.combine(
			new ErrorFormatter(),
			new LanguageServerFormatter({
				connection,
				preferredKeyOrder: ['module', 'uri', 'command'],
			}),
		),
	}),
];

if (level === 'debug') {
	transports.push(
		new winston.transports.File({
			filename: path.join(__dirname, '../stylelint-language-server.log'),
			level,
			format: winston.format.combine(
				new ErrorFormatter(),
				winston.format.timestamp(),
				winston.format.json(),
			),
		}),
	);
}

const logger = winston.createLogger({ level, transports });

const server = new StylelintLanguageServer({
	connection,
	logger,
	modules: Object.values(modules),
});

server.start();
