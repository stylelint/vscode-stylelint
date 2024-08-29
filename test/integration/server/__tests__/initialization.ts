import * as LSP from 'vscode-languageserver-protocol';
import { StylelintLanguageServer } from '../../../../src/server/index';

describe('Initialization', () => {
	const connectionManager = new ConnectionManager();
	let server: StylelintLanguageServer;
	let connection: LSP.ProtocolConnection;

	beforeAll(() => {
		connectionManager.initialize();
		server = new StylelintLanguageServer({ connection: connectionManager.serverConnection });
		server.start();
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

		expect(result).toEqual({
			capabilities: {
				textDocumentSync: {
					change: 1,
					openClose: true,
				},
			},
		});
	});
});
