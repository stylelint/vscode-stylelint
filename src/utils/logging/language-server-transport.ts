import TransportStream from 'winston-transport';
import { LEVEL, MESSAGE } from 'triple-beam';
import type winston from 'winston';
import type { Connection, RemoteConsole } from 'vscode-languageserver/node';
import type { TransportStreamOptions } from 'winston-transport';

import { getLogFunction } from './get-log-function';

/**
 * Language server log transport options.
 */
export type LanguageServerTransportOptions = TransportStreamOptions & {
	connection: Connection;
};

/**
 * Winston transport for logging through the language server connection.
 */
export class LanguageServerTransport extends TransportStream {
	/**
	 * The language server remote console.
	 */
	#console: RemoteConsole;

	constructor(options: LanguageServerTransportOptions) {
		super(options);

		this.#console = options.connection.console;
	}

	log(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		info: winston.Logform.TransformableInfo & { [key: string | symbol]: any },
		callback: () => void,
	): void {
		setImmediate(() => {
			this.emit('logged', info);
		});

		const logFunc = getLogFunction(this.#console, String(info[LEVEL]));

		if (typeof logFunc === 'function') {
			(logFunc as (message: string) => void).call(this.#console, String(info[MESSAGE]));
		} else {
			this.#console.log(String(info[MESSAGE]));
		}

		callback();
	}
}
