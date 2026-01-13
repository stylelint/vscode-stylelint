import childProcess from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';

import { testOnVersion } from '../../../helpers/versions.js';

type StartedServer = {
	process: childProcess.ChildProcessWithoutNullStreams;
	connection: LSP.ProtocolConnection;
};

const startServer = (): StartedServer => {
	const serverModulePath = path.join(
		__dirname,
		'..',
		'..',
		'..',
		'..',
		'src',
		'extension',
		'start-server.ts',
	);

	const child = childProcess.spawn(
		process.execPath,
		['-r', 'tsx/cjs', serverModulePath, '--stdio'],
		{
			stdio: ['pipe', 'pipe', 'pipe'],
			env: { ...process.env, STYLELINT_LOG_LEVEL: 'error' },
		},
	);

	child.stderr.on('data', (chunk) => {
		// Surface server stderr to help diagnose startup issues in tests.
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
	ms = 5000,
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

const openDocumentAndWaitForDiagnostics = async (
	client: LSP.ProtocolConnection,
	uri: string,
	languageId: string,
	text: string,
) => {
	const version = 2;
	const diagnosticsPromise = waitForNotification<LSP.PublishDiagnosticsParams>(
		client,
		LSP.PublishDiagnosticsNotification.type,
		(params) => params.uri === uri,
		10000,
	);

	await client.sendNotification(LSP.DidOpenTextDocumentNotification.type, {
		textDocument: {
			uri,
			languageId,
			version: version - 1,
			text,
		},
	});

	await client.sendNotification(LSP.DidChangeTextDocumentNotification.type, {
		textDocument: {
			uri,
			version,
		},
		contentChanges: [{ text }],
	});

	const diagnostics = await diagnosticsPromise;

	return { diagnostics, version } as const;
};

const closeDocument = async (client: LSP.ProtocolConnection, uri: string) => {
	await client.sendNotification(LSP.DidCloseTextDocumentNotification.type, {
		textDocument: { uri },
	});
};

describe('Language server', () => {
	let startedServer: StartedServer;
	let client: LSP.ProtocolConnection;
	let workspaceRoot: string;
	let initResult: LSP.InitializeResult;
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
			rootUri: pathToFileURL(workspaceRoot).toString(),
			capabilities: {
				workspace: { configuration: true },
			},
			workspaceFolders: null,
		};

		initResult = await client.sendRequest(LSP.InitializeRequest.type, initParams);
		await client.sendNotification(LSP.InitializedNotification.type, {});
	});

	afterAll(async () => {
		await shutdownServer(startedServer);
	});

	it('exposes expected capabilities', async () => {
		expect(initResult).toMatchObject({
			capabilities: {
				codeActionProvider: { codeActionKinds: ['quickfix', 'source.fixAll.stylelint'] },
				completionProvider: {},
				documentFormattingProvider: true,
				executeCommandProvider: {
					commands: ['stylelint.applyAutoFix', 'stylelint.openRuleDoc'],
				},
				textDocumentSync: LSP.TextDocumentSyncKind.Full,
			},
		});
	});

	it('publishes diagnostics for invalid CSS content', async () => {
		stylelintSettings = {
			config: {
				rules: { 'color-no-invalid-hex': true },
			},
			validate: ['css'],
		};

		await client.sendNotification(LSP.DidChangeConfigurationNotification.type, {
			settings: { stylelint: stylelintSettings },
		});

		const documentUri = pathToFileURL(path.join(workspaceRoot, 'diagnostics.css')).toString();
		const diagnosticsParamsPromise = waitForNotification<LSP.PublishDiagnosticsParams>(
			client,
			LSP.PublishDiagnosticsNotification.type,
			(params) => params.uri === documentUri,
			10000,
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
			textDocument: {
				uri: documentUri,
				version: 2,
			},
			contentChanges: [{ text: 'a { color: #y3; }' }],
		});

		const diagnosticsParams = await diagnosticsParamsPromise;
		const [diagnostic] = diagnosticsParams.diagnostics;

		expect(diagnosticsParams.diagnostics).not.toHaveLength(0);
		expect(diagnostic).toMatchObject({
			code: 'color-no-invalid-hex',
			source: 'Stylelint',
		});
		expect(diagnostic.message).toContain('color-no-invalid-hex');

		await closeDocument(client, documentUri);
	});

	it('provides quick fixes and fix-all code actions', async () => {
		stylelintSettings = {
			config: {
				rules: { 'length-zero-no-unit': true },
			},
			validate: ['css'],
		};

		await client.sendNotification(LSP.DidChangeConfigurationNotification.type, {
			settings: { stylelint: stylelintSettings },
		});

		const documentUri = pathToFileURL(path.join(workspaceRoot, 'code-actions.css')).toString();
		const documentText = 'a { margin: 0px; }\n';
		const { diagnostics, version } = await openDocumentAndWaitForDiagnostics(
			client,
			documentUri,
			'css',
			documentText,
		);

		const [diagnostic] = diagnostics.diagnostics;

		expect(diagnostic?.code).toBe('length-zero-no-unit');

		const quickFixActions =
			(await client.sendRequest(LSP.CodeActionRequest.type, {
				textDocument: { uri: documentUri },
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 0 },
				},
				context: { diagnostics: diagnostics.diagnostics, only: [LSP.CodeActionKind.QuickFix] },
			})) ?? [];

		const quickFix = quickFixActions.find(
			(action): action is LSP.CodeAction =>
				!('command' in action) && action.kind === LSP.CodeActionKind.QuickFix,
		);

		expect(quickFix?.edit?.documentChanges?.[0]).toBeDefined();

		const quickFixEdit = quickFix?.edit?.documentChanges?.[0] as LSP.TextDocumentEdit | undefined;
		const quickFixedText = quickFixEdit
			? TextDocument.applyEdits(
					TextDocument.create(documentUri, 'css', version, documentText),
					quickFixEdit.edits,
				)
			: undefined;

		const quickFixExpectationMet =
			quickFixedText === 'a { margin: 0; }\n' ||
			quickFixedText?.includes('stylelint-disable-next-line length-zero-no-unit') === true;

		expect(quickFixExpectationMet).toBe(true);

		const fixAllActions =
			(await client.sendRequest(LSP.CodeActionRequest.type, {
				textDocument: { uri: documentUri },
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 0 },
				},
				context: {
					diagnostics: diagnostics.diagnostics,
					only: [LSP.CodeActionKind.SourceFixAll],
				},
			})) ?? [];

		const fixAll = fixAllActions.find(
			(action): action is LSP.CodeAction =>
				!('command' in action) && action.kind === 'source.fixAll.stylelint',
		);

		expect(fixAll?.edit?.documentChanges?.[0]).toBeDefined();

		const fixAllEdit = fixAll?.edit?.documentChanges?.[0] as LSP.TextDocumentEdit | undefined;
		const fixAllText = fixAllEdit
			? TextDocument.applyEdits(
					TextDocument.create(documentUri, 'css', version, documentText),
					fixAllEdit.edits,
				)
			: undefined;

		expect(fixAllText).toBe('a { margin: 0; }\n');

		await closeDocument(client, documentUri);
	});

	it('applies auto-fixes via executeCommand', async () => {
		stylelintSettings = {
			config: {
				rules: { 'length-zero-no-unit': true },
			},
			validate: ['css'],
		};

		await client.sendNotification(LSP.DidChangeConfigurationNotification.type, {
			settings: { stylelint: stylelintSettings },
		});

		const documentUri = pathToFileURL(path.join(workspaceRoot, 'auto-fix.css')).toString();
		const documentText = 'a { margin: 0px; }\n';
		const { version } = await openDocumentAndWaitForDiagnostics(
			client,
			documentUri,
			'css',
			documentText,
		);

		let updatedText = documentText;
		const applyEditRequests: LSP.ApplyWorkspaceEditParams[] = [];
		const disposable = client.onRequest(
			LSP.ApplyWorkspaceEditRequest.type.method,
			(params: LSP.ApplyWorkspaceEditParams) => {
				applyEditRequests.push(params);
				const [change] = params.edit.documentChanges ?? [];

				if (!change || !('edits' in change)) {
					return { applied: false };
				}

				updatedText = TextDocument.applyEdits(
					TextDocument.create(documentUri, 'css', version, updatedText),
					change.edits,
				);

				return { applied: true };
			},
		);

		await client.sendRequest(LSP.ExecuteCommandRequest.type, {
			command: 'stylelint.applyAutoFix',
			arguments: [{ uri: documentUri, version }],
		});

		disposable.dispose();

		expect(applyEditRequests).toHaveLength(1);
		expect(updatedText).toBe('a { margin: 0; }\n');

		await closeDocument(client, documentUri);
	});

	it('continues linting when a custom stylelintPath returns recursive data', async () => {
		stylelintSettings = {
			stylelintPath: path.join(workspaceRoot, 'fake-stylelint-recursive.js'),
			validate: ['css'],
		};

		await client.sendNotification(LSP.DidChangeConfigurationNotification.type, {
			settings: { stylelint: stylelintSettings },
		});

		const documentUri = pathToFileURL(path.join(workspaceRoot, 'recursive.css')).toString();
		const { diagnostics } = await openDocumentAndWaitForDiagnostics(
			client,
			documentUri,
			'css',
			'a { color: #000; }',
		);

		expect(diagnostics.diagnostics[0]?.code).toBe('fake-recursive');

		await closeDocument(client, documentUri);
	});

	testOnVersion('<15', 'formats documents according to formatting options', async () => {
		stylelintSettings = { validate: ['css'] };

		await client.sendNotification(LSP.DidChangeConfigurationNotification.type, {
			settings: { stylelint: stylelintSettings },
		});

		const documentUri = pathToFileURL(path.join(workspaceRoot, 'formatting.css')).toString();
		const documentText = 'a {\n\tcolor: red;  \n}\n';
		const version = 2;

		await client.sendNotification(LSP.DidOpenTextDocumentNotification.type, {
			textDocument: {
				uri: documentUri,
				languageId: 'css',
				version: version - 1,
				text: documentText,
			},
		});

		await client.sendNotification(LSP.DidChangeTextDocumentNotification.type, {
			textDocument: {
				uri: documentUri,
				version,
			},
			contentChanges: [{ text: documentText }],
		});

		const edits = await client.sendRequest(LSP.DocumentFormattingRequest.type, {
			textDocument: { uri: documentUri },
			options: {
				insertSpaces: true,
				tabSize: 2,
				insertFinalNewline: true,
				trimTrailingWhitespace: true,
			},
		});

		const formatted = TextDocument.applyEdits(
			TextDocument.create(documentUri, 'css', version, documentText),
			edits ?? [],
		);

		expect(formatted).toBe('a {\n  color: red;\n}\n');

		await closeDocument(client, documentUri);
	});
});
