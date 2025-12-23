// Part of test utils, don't record coverage
/* istanbul ignore file */

import { Duplex } from 'stream';
import * as LSP from 'vscode-languageserver-protocol';
import {
	StreamMessageReader,
	StreamMessageWriter,
	type Connection,
	type WatchDog,
} from 'vscode-languageserver/node';
import { createConnection } from 'vscode-languageserver/lib/common/server';

class TestStream extends Duplex {
	_write(chunk: string, _encoding: string, done: () => void) {
		this.emit('data', chunk);
		done();
	}

	_read() {
		// do nothing
	}
}

/**
 * Creates a watch dog that doesn't do anything other than ending the connection
 * when `exit()` is called.
 */
function createWatchDog(connection: LSP.ProtocolConnection): WatchDog {
	let shutdownReceived = false;

	return {
		initialize: () => undefined,

		get shutdownReceived(): boolean {
			return shutdownReceived;
		},

		set shutdownReceived(value: boolean) {
			shutdownReceived = value;
		},

		exit: (): void => {
			if (!connection) {
				return;
			}

			try {
				connection.end();
			} catch {
				// ignore
			}
		},
	};
}

/**
 * Manages connections used for testing the language server.
 */
export class ConnectionManager {
	#serverProtocolConnection?: LSP.ProtocolConnection;
	#serverConnection?: Connection;
	#clientProtocolConnection?: LSP.ProtocolConnection;

	initialize() {
		const up = new TestStream();
		const down = new TestStream();
		const downReader = new StreamMessageReader(down);
		const upReader = new StreamMessageReader(up);
		const downWriter = new StreamMessageWriter(down);
		const upWriter = new StreamMessageWriter(up);
		const serverProtocolConnection = LSP.createProtocolConnection(upReader, downWriter);
		const clientProtocolConnection = LSP.createProtocolConnection(downReader, upWriter);
		const watchDog = createWatchDog(serverProtocolConnection);

		this.#serverConnection = createConnection(() => serverProtocolConnection, watchDog);
		this.#serverProtocolConnection = serverProtocolConnection;
		this.#clientProtocolConnection = clientProtocolConnection;
	}

	get serverConnection(): Connection {
		if (!this.#serverConnection) {
			throw new Error('Server connection not initialized');
		}

		return this.#serverConnection;
	}

	get serverProtocolConnection(): LSP.ProtocolConnection {
		if (!this.#serverProtocolConnection) {
			throw new Error('Server connection not initialized');
		}

		return this.#serverProtocolConnection;
	}

	get clientProtocolConnection(): LSP.ProtocolConnection {
		if (!this.#clientProtocolConnection) {
			throw new Error('Client connection not initialized');
		}

		return this.#clientProtocolConnection;
	}

	async shutdown() {
		let timeoutRef: NodeJS.Timeout | undefined = undefined;
		const timeout = new Promise<void>((resolve) => {
			timeoutRef = setTimeout(resolve, 3000);
		});
		const shutdown = (async () => {
			await this.clientProtocolConnection.sendRequest(LSP.ShutdownRequest.type);
			await this.clientProtocolConnection.sendNotification(LSP.ExitNotification.type);

			return this.clientProtocolConnection;
		})();

		const connection = await Promise.race([timeout, shutdown]);

		try {
			if (connection) {
				connection.end();
				connection.dispose();

				if (timeoutRef) clearTimeout(timeoutRef);
			} else {
				throw new Error('Stopping server timed out');
			}
		} finally {
			this.serverConnection.dispose();
			this.serverProtocolConnection.dispose();
			this.clientProtocolConnection.dispose();
		}
	}
}
