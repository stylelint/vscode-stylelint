'use strict';

const { createConnection, ProposedFeatures } = require('vscode-languageserver/node');
const winston = require('winston');
const { StylelintLanguageServer, modules } = require('./server');

const connection = createConnection(ProposedFeatures.all);

const {
	ErrorFormatter,
	LanguageServerTransport,
	LanguageServerFormatter,
} = require('./utils/logging');

const { NODE_ENV } = process.env;

const level = NODE_ENV === 'development' ? 'debug' : 'info';

/** @type {winston.transport[]} */
const transports = [
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
			filename: require('path').join(__dirname, '../stylelint-language-server.log'),
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
