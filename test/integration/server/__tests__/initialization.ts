import * as LSP from 'vscode-languageserver-protocol';
import { StylelintLanguageServer } from '../../../../src/server/index.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConnectionManager } from '../../connection-manager.js';

describe('Initialization', () => {
	const connectionManager = new ConnectionManager();
	let server: StylelintLanguageServer;
	let connection: LSP.ProtocolConnection;

	beforeAll(async () => {
		connectionManager.initialize();
		server = new StylelintLanguageServer({
			connection: connectionManager.serverConnection,
		});

		await server.start();
		connectionManager.clientProtocolConnection.listen();
		connection = connectionManager.clientProtocolConnection;
	});

	afterAll(async () => {
		await connectionManager.shutdown();
	});

	it('should respond to InitializeRequest with an InitializeResult', async () => {
		const init: LSP.InitializeParams = {
			rootUri: 'file:///home/test/test.css',
			processId: 1,
			capabilities: {},
			workspaceFolders: null,
		};

		const result = await connection.sendRequest(LSP.InitializeRequest.type, init);

		expect(result).toMatchSnapshot();
	});
});
