import childProcess from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as LSP from 'vscode-languageserver-protocol';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';

type StartedServer = {
	process: childProcess.ChildProcessWithoutNullStreams;
	connection: LSP.ProtocolConnection;
};

/**
 * Starts the language server using the ESM bin entry point.
 */
const startServer = (): StartedServer => {
	const serverBin = path.join(
		__dirname,
		'..',
		'..',
		'..',
		'..',
		'packages',
		'language-server',
		'bin',
		'stylelint-language-server.mjs',
	);

	const child = childProcess.spawn(process.execPath, [serverBin, '--stdio'], {
		stdio: ['pipe', 'pipe', 'pipe'],
		env: { ...process.env, STYLELINT_LOG_LEVEL: 'error' },
	});

	child.stderr.on('data', (chunk) => {
		process.stderr.write(`[stylelint-server stderr] ${chunk}`);
	});

	child.on('exit', (code, signal) => {
		if (code !== 0 && code !== null) {
			process.stderr.write(
				`[stylelint-server exit] code=${code}${signal ? ` signal=${signal}` : ''}\n`,
			);
		}
	});

	const reader = new StreamMessageReader(child.stdout);
	const writer = new StreamMessageWriter(child.stdin);
	const connection = LSP.createProtocolConnection(reader, writer);

	connection.listen();

	return { process: child, connection };
};

const shutdownServer = async ({ process: child, connection }: StartedServer) => {
	try {
		await connection.sendRequest(LSP.ShutdownRequest.type);
		await connection.sendNotification(LSP.ExitNotification.type);
	} catch {
		// Ignore shutdown errors during cleanup.
	}

	try {
		connection.dispose();
	} catch {
		// Ignore cleanup errors during cleanup.
	}

	await new Promise<void>((resolve) => {
		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			resolve();
		}, 3000);

		child.once('exit', () => {
			clearTimeout(timer);
			resolve();
		});
	});
};

const waitForNotification = <T>(
	connection: LSP.ProtocolConnection,
	type: LSP.ProtocolNotificationType<T, unknown> | LSP.NotificationType<T>,
	predicate?: (params: T) => boolean,
	ms = 10000,
): Promise<T> =>
	new Promise((resolve, reject) => {
		// eslint-disable-next-line prefer-const -- Assigned after handler is defined.
		let timeoutId: NodeJS.Timeout;
		const disposable = connection.onNotification(type as LSP.NotificationType<T>, (params: T) => {
			if (!predicate || predicate(params)) {
				clearTimeout(timeoutId);
				disposable.dispose();
				resolve(params);
			}
		});

		timeoutId = setTimeout(() => {
			disposable.dispose();
			reject(new Error('Timed out waiting for notification'));
		}, ms);
	});

describe('Language server (ESM)', () => {
	let startedServer: StartedServer;
	let client: LSP.ProtocolConnection;
	let workspaceRoot: string;
	let stylelintSettings: unknown;

	beforeAll(async () => {
		workspaceRoot = path.join(__dirname, '..', '..', 'stylelint-vscode');
		startedServer = startServer();
		client = startedServer.connection;

		client.onRequest(LSP.RegistrationRequest.type.method, () => ({}));
		client.onRequest(LSP.UnregistrationRequest.type.method, () => undefined);
		client.onRequest(LSP.ConfigurationRequest.type.method, (params) => {
			if (!params.items || params.items.length === 0) {
				return stylelintSettings;
			}

			return params.items.map(() => stylelintSettings);
		});
		client.onRequest(LSP.WorkspaceFoldersRequest.type.method, () => [
			{
				uri: pathToFileURL(workspaceRoot).toString(),
				name: 'stylelint-vscode',
			},
		]);
		client.onRequest(LSP.ShowMessageRequest.type.method, () => null);
		client.onNotification(LSP.ShowMessageNotification.type, () => undefined);
		client.onNotification(LSP.LogMessageNotification.type, () => undefined);

		const initParams: LSP.InitializeParams = {
			processId: null,
			clientInfo: { name: 'test-esm-client' },
			rootUri: pathToFileURL(workspaceRoot).toString(),
			capabilities: {
				workspace: { configuration: true },
			},
			workspaceFolders: null,
		};

		await client.sendRequest(LSP.InitializeRequest.type, initParams);
		await client.sendNotification(LSP.InitializedNotification.type, {});
	});

	afterAll(async () => {
		await shutdownServer(startedServer);
	});

	it('publishes diagnostics when run as ESM', async () => {
		stylelintSettings = {
			config: {
				rules: { 'color-no-invalid-hex': true },
			},
			validate: ['css'],
		};

		await client.sendNotification(LSP.DidChangeConfigurationNotification.type, {
			settings: { stylelint: stylelintSettings },
		});

		const documentUri = pathToFileURL(path.join(workspaceRoot, 'esm-diagnostics.css')).toString();

		const diagnosticsPromise = waitForNotification<LSP.PublishDiagnosticsParams>(
			client,
			LSP.PublishDiagnosticsNotification.type,
			(params) => params.uri === documentUri,
		);

		await client.sendNotification(LSP.DidOpenTextDocumentNotification.type, {
			textDocument: {
				uri: documentUri,
				languageId: 'css',
				version: 1,
				text: 'a { color: #y3; }',
			},
		});

		await client.sendNotification(LSP.DidChangeTextDocumentNotification.type, {
			textDocument: { uri: documentUri, version: 2 },
			contentChanges: [{ text: 'a { color: #y3; }' }],
		});

		const diagnosticsParams = await diagnosticsPromise;
		const [diagnostic] = diagnosticsParams.diagnostics;

		expect(diagnosticsParams.diagnostics).not.toHaveLength(0);
		expect(diagnostic).toMatchObject({
			code: 'color-no-invalid-hex',
			source: 'Stylelint',
		});

		await client.sendNotification(LSP.DidCloseTextDocumentNotification.type, {
			textDocument: { uri: documentUri },
		});
	});
});
