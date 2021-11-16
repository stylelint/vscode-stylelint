import { Duplex } from 'stream';
import * as LSP from 'vscode-languageserver-protocol';
import {
	Connection,
	createConnection,
	StreamMessageReader,
	StreamMessageWriter,
} from 'vscode-languageserver/node';
import { StylelintLanguageServer } from '../../../../src/server';

class TestStream extends Duplex {
	_write(chunk: string, _encoding: string, done: () => void) {
		this.emit('data', chunk);
		done();
	}

	_read() {
		// do nothing
	}
}

const getConnections = (): [serverConnection: Connection, clientConnection: Connection] => {
	const up = new TestStream();
	const down = new TestStream();
	const serverConnection = createConnection(
		new StreamMessageReader(up),
		new StreamMessageWriter(down),
	);
	const clientConnection = createConnection(
		new StreamMessageReader(down),
		new StreamMessageWriter(up),
	);

	return [serverConnection, clientConnection];
};

describe('Initialization', () => {
	it('should respond to InitializeRequest with an InitializeResult', async () => {
		const [serverConnection, clientConnection] = getConnections();
		const server = new StylelintLanguageServer({ connection: serverConnection });

		server.start();
		clientConnection.listen();

		const init: LSP.InitializeParams = {
			rootUri: 'file:///home/test/test.css',
			processId: 1,
			capabilities: {},
			workspaceFolders: null,
		};

		const result = await clientConnection.sendRequest(LSP.InitializeRequest.type, init);

		expect(result).toMatchInlineSnapshot(`
		Object {
		  "capabilities": Object {
		    "textDocumentSync": Object {
		      "change": 1,
		      "openClose": true,
		    },
		  },
		}
	`);
	});
});
