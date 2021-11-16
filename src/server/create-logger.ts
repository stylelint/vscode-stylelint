import winston from 'winston';
import { Connection } from 'vscode-languageserver';
import { ErrorFormatter, LanguageServerFormatter, LanguageServerTransport } from '../utils/logging';

/**
 * Returns a Winston logger configured for the language server.
 * @param connection The language server connection.
 * @param level The log level. Defaults to `info`.
 * @param logPath If provided, adds a file transport with the given path.
 */
export function createLogger(
	connection: Connection,
	level: 'error' | 'warn' | 'info' | 'debug' = 'info',
	logPath?: string,
): winston.Logger {
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

	if (logPath) {
		transports.push(
			new winston.transports.File({
				filename: logPath,
				format: winston.format.combine(
					new ErrorFormatter(),
					winston.format.timestamp(),
					winston.format.json(),
				),
			}),
		);
	}

	return winston.createLogger({
		level,
		transports,
		levels: {
			error: 0,
			warn: 1,
			info: 2,
			debug: 3,
		},
	});
}
