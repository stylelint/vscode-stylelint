import { Connection } from 'vscode-languageserver';
import winston from 'winston';
import { FactoryRegistration, createToken } from '../../../di/index.js';
import {
	ErrorFormatter,
	LanguageServerFormatter,
	LanguageServerTransport,
} from '../../utils/index.js';
import { lspConnectionToken } from '../../tokens.js';
import { type LoggingService, loggingServiceToken } from './logging.service.js';

export const winstonToken = createToken<typeof winston>('Winston');

/**
 * Creates a Winston-based logging service.
 */
export function createWinstonLoggingService(
	level: 'error' | 'warn' | 'info' | 'debug' = 'info',
	logPath?: string,
): FactoryRegistration<LoggingService, [Connection, typeof winston]> {
	return {
		token: loggingServiceToken,
		inject: [lspConnectionToken, winstonToken],
		useFactory: (connection: Connection, winstonModule: typeof winston) => {
			const transports: winston.transport[] = [
				new LanguageServerTransport({
					connection,
					format: winstonModule.format.combine(
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
					new winstonModule.transports.File({
						filename: logPath,
						format: winstonModule.format.combine(
							new ErrorFormatter(),
							winstonModule.format.timestamp(),
							winstonModule.format.json(),
						),
					}),
				);
			}

			const logger = winstonModule.createLogger({
				level,
				transports,
				levels: {
					error: 0,
					warn: 1,
					info: 2,
					debug: 3,
				},
			});

			return {
				createLogger: (component: new () => unknown) => {
					const moduleName = component.name || 'UnknownModule';

					return logger.child({ module: moduleName });
				},
			};
		},
	};
}
