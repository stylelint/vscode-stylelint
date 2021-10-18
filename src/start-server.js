const { createConnection, ProposedFeatures } = require('vscode-languageserver/node');
const winston = require('winston');
const { StylelintLanguageServer } = require('./server');

const connection = createConnection(ProposedFeatures.all);

const { LanguageServerTransport, LanguageServerFormatter } = require('./utils/logging');

const logger = winston.createLogger({
	level: 'debug',
	transports: [
		new LanguageServerTransport({
			connection,
			format: new LanguageServerFormatter({
				connection,
				preferredKeyOrder: ['module', 'uri', 'command'],
			}),
		}),
		new winston.transports.File({
			filename: require('path').join(__dirname, '../stylelint-language-server.log'),
			level: 'debug',
			format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
		}),
	],
});

const server = new StylelintLanguageServer(connection, logger);

server.start();
