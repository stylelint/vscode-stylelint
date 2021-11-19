jest.mock('vscode-uri', () => {
	const vscodeUri = jest.requireActual('vscode-uri');
	const mock = jest.createMockFromModule<typeof vscodeUri>('vscode-uri');

	mock.URI.parse = (uri: string) => {
		const parsed = vscodeUri.URI.parse(uri);

		if (parsed.scheme === 'file') {
			return parsed;
		}

		const fsPath = parsed.fsPath?.replace(/\//g, '\\');

		return {
			...parsed,
			fsPath,
		};
	};

	return mock;
});

import { WorkDoneProgressReporter } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, TextEdit } from 'vscode-languageserver-types';

import { Notification } from '../../types';
import { FormatterModule } from '../formatter';

const mockContext = serverMocks.getContext();
const mockLogger = serverMocks.getLogger();

describe('FormatterModule', () => {
	beforeEach(() => {
		mockContext.__options.validate = [];
		jest.clearAllMocks();
	});

	test('should be constructable', () => {
		expect(() => new FormatterModule({ context: mockContext.__typed() })).not.toThrow();
	});

	test('without client dynamic registration support, onInitialize should request static registration', () => {
		const module = new FormatterModule({ context: mockContext.__typed() });

		expect(
			module.onInitialize({
				capabilities: {
					textDocument: {
						formatting: { dynamicRegistration: false },
					},
				},
			} as unknown as LSP.InitializeParams),
		).toMatchSnapshot();
	});

	test('with client dynamic registration support, onInitialize should not request static registration', () => {
		const module = new FormatterModule({ context: mockContext.__typed() });

		expect(
			module.onInitialize({
				capabilities: {
					textDocument: {
						formatting: { dynamicRegistration: true },
					},
				},
			} as unknown as LSP.InitializeParams),
		).toMatchSnapshot();
	});

	test('onDidRegisterHandlers should register a document formatting command handler', () => {
		const module = new FormatterModule({ context: mockContext.__typed() });

		module.onDidRegisterHandlers();

		expect(mockContext.connection.onDocumentFormatting).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.onDocumentFormatting).toHaveBeenCalledWith(expect.any(Function));
	});

	test('should format documents', async () => {
		mockContext.documents.get.mockReturnValue(TextDocument.create('foo', 'bar', 1, 'a {}'));
		mockContext.__options.validate = ['bar'];
		mockContext.getFixes.mockResolvedValue([TextEdit.insert(Position.create(0, 0), 'text')]);

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onDocumentFormatting.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'foo' },
				options: {
					insertSpaces: true,
					tabSize: 2,
					insertFinalNewline: true,
					trimFinalNewlines: false,
				},
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toMatchSnapshot();
		expect(mockContext.getFixes.mock.calls[0]).toMatchSnapshot();
		expect(await mockContext.getFixes.mock.results[0].value).toStrictEqual(result);
	});

	test('with no text document, should not attempt to format', async () => {
		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onDocumentFormatting.mock.calls[0][0];

		const result = await handler(
			{
				options: { insertSpaces: true, tabSize: 2 },
				textDocument: undefined as unknown as LSP.TextDocumentIdentifier,
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toBeNull();
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('No text document provided, ignoring');
	});

	test('if no matching document exists, should not attempt to format', async () => {
		mockContext.documents.get.mockReturnValue(undefined);

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onDocumentFormatting.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'foo' },
				options: { insertSpaces: true, tabSize: 2 },
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toBeNull();
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Unknown document, ignoring', { uri: 'foo' });
	});

	test('if document language ID is not in options, should not attempt to format', async () => {
		mockContext.documents.get.mockReturnValue(TextDocument.create('foo', 'bar', 1, 'a {}'));
		mockContext.__options.validate = ['baz'];

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onDocumentFormatting.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'foo' },
				options: { insertSpaces: true, tabSize: 2 },
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toBeNull();
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Document should not be formatted, ignoring',
			{
				uri: 'foo',
				language: 'bar',
			},
		);
	});

	test('with no debug log level and no valid document, should not attempt to log reason', async () => {
		mockContext.documents.get.mockReturnValue(TextDocument.create('foo', 'bar', 1, 'a {}'));
		mockContext.__options.validate = ['baz'];
		mockLogger.isDebugEnabled.mockReturnValue(false);

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onDocumentFormatting.mock.calls[0][0];

		const handlerParams: LSP.DocumentFormattingParams = {
			textDocument: { uri: 'foo' },
			options: { insertSpaces: true, tabSize: 2 },
		};

		const result = await handler(
			handlerParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toBeNull();
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Received onDocumentFormatting',
			handlerParams,
		);
	});

	test("without client dynamic registration support, documents.onDidOpen shouldn't register a formatter", async () => {
		mockContext.__options.validate = ['bar'];

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: false },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await onDidOpenHandler({ document: TextDocument.create('foo', 'bar', 1, 'a {}') });

		expect(mockContext.connection.client.register).not.toHaveBeenCalled();
	});

	test("without client dynamic registration support, documents.onDidChangeContent shouldn't register a formatter", async () => {
		mockContext.__options.validate = ['bar'];

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: false },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidChangeContentHandler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await onDidChangeContentHandler({ document: TextDocument.create('foo', 'bar', 1, 'a {}') });

		expect(mockContext.connection.client.register).not.toHaveBeenCalled();
	});

	test("without client dynamic registration support, documents.onDidSave shouldn't register a formatter", async () => {
		mockContext.__options.validate = ['bar'];

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: false },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidSaveHandler = mockContext.documents.onDidSave.mock.calls[0][0];

		await onDidSaveHandler({ document: TextDocument.create('foo', 'bar', 1, 'a {}') });

		expect(mockContext.connection.client.register).not.toHaveBeenCalled();
	});

	test('with client dynamic registration support, documents.onDidOpen should register a formatter', async () => {
		mockContext.__options.validate = ['bar'];

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await onDidOpenHandler({
			document: TextDocument.create('file:///dir/test.css', 'bar', 1, 'a {}'),
		});
		await onDidOpenHandler({
			document: TextDocument.create('scheme:///dir/test.css', 'bar', 1, 'a {}'),
		});

		expect(mockContext.connection.client.register).toHaveBeenCalledWith(
			LSP.DocumentFormattingRequest.type,
			{ documentSelector: [{ scheme: 'file', pattern: '/dir/test.css' }] },
		);
		expect(mockContext.connection.client.register).toHaveBeenCalledWith(
			LSP.DocumentFormattingRequest.type,
			{ documentSelector: [{ scheme: 'scheme', pattern: '\\dir\\test.css' }] },
		);
	});

	test('with client dynamic registration support, documents.onDidChangeContent should register a formatter', async () => {
		mockContext.__options.validate = ['bar'];

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidChangeContentHandler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await onDidChangeContentHandler({
			document: TextDocument.create('file:///dir/test.css', 'bar', 1, 'a {}'),
		});

		expect(mockContext.connection.client.register).toHaveBeenCalledWith(
			LSP.DocumentFormattingRequest.type,
			{ documentSelector: [{ scheme: 'file', pattern: '/dir/test.css' }] },
		);
	});

	test('with client dynamic registration support, documents.onDidSave should register a formatter', async () => {
		mockContext.__options.validate = ['bar'];

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidSaveHandler = mockContext.documents.onDidSave.mock.calls[0][0];

		await onDidSaveHandler({
			document: TextDocument.create('file:///dir/test.css', 'bar', 1, 'a {}'),
		});

		expect(mockContext.connection.client.register).toHaveBeenCalledWith(
			LSP.DocumentFormattingRequest.type,
			{ documentSelector: [{ scheme: 'file', pattern: '/dir/test.css' }] },
		);
	});

	test('when a formatter was registered, documents.onDidClose should dispose the old registration', async () => {
		mockContext.__options.validate = ['bar'];
		mockLogger.isDebugEnabled.mockReturnValue(true);

		const mockRegistration = { dispose: jest.fn() };

		mockContext.connection.client.register.mockResolvedValueOnce(mockRegistration);

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const document = TextDocument.create('file:///dir/test.css', 'bar', 1, 'a {}');

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];
		const onDidCloseHandler = mockContext.documents.onDidClose.mock.calls[0][0];

		await onDidOpenHandler({ document });
		await onDidCloseHandler({ document });

		expect(mockRegistration.dispose).toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenCalledWith('Deregistering formatter for document', {
			uri: 'file:///dir/test.css',
		});
	});

	test('when a formatter was registered, if registration rejects, documents.onDidClose should log an error', async () => {
		const error = new Error('test');

		mockContext.__options.validate = ['bar'];
		mockLogger.isDebugEnabled.mockReturnValue(true);

		mockContext.connection.client.register.mockRejectedValueOnce(error);

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const document = TextDocument.create('file:///dir/test.css', 'bar', 1, 'a {}');

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];
		const onDidCloseHandler = mockContext.documents.onDidClose.mock.calls[0][0];

		await onDidOpenHandler({ document });
		await onDidCloseHandler({ document });

		await new Promise((resolve) => setImmediate(resolve));

		expect(mockLogger.error).toHaveBeenCalledWith('Error deregistering formatter for document', {
			uri: 'file:///dir/test.css',
			error,
		});
	});

	test('when a formatter was not registered, documents.onDidClose should not try to dispose a registration', async () => {
		mockContext.__options.validate = ['bar'];
		mockLogger.isDebugEnabled.mockReturnValue(true);

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidCloseHandler = mockContext.documents.onDidClose.mock.calls[0][0];

		await onDidCloseHandler({
			document: TextDocument.create('file:///dir/test.css', 'bar', 1, 'a {}'),
		});

		expect(mockLogger.debug).not.toHaveBeenCalledWith('Deregistering formatter for document', {
			uri: 'file:///dir/test.css',
		});
	});

	test('when formatters were registered, DidChangeConfigurationNotification should deregister all registrations', async () => {
		mockContext.__options.validate = ['bar'];
		mockLogger.isDebugEnabled.mockReturnValue(true);

		const mockRegistration = { dispose: jest.fn() };

		mockContext.connection.client.register.mockResolvedValue(mockRegistration);

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await onDidOpenHandler({
			document: TextDocument.create('file:///dir/test-1.css', 'bar', 1, 'a {}'),
		});
		await onDidOpenHandler({
			document: TextDocument.create('file:///dir/test-2.css', 'bar', 1, 'a {}'),
		});

		const didChangeConfigurationNotificationHandler = mockContext.notifications.on.mock.calls.find(
			([type]) => type === LSP.DidChangeConfigurationNotification.type,
		)?.[1];

		await didChangeConfigurationNotificationHandler?.();

		expect(mockRegistration.dispose).toHaveBeenCalledTimes(2);
	});

	test('when formatters were registered, if registration rejects, DidChangeConfigurationNotification should log an error', async () => {
		const error = new Error('test');

		mockContext.__options.validate = ['bar'];
		mockLogger.isDebugEnabled.mockReturnValue(true);

		mockContext.connection.client.register.mockRejectedValue(error);

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await onDidOpenHandler({
			document: TextDocument.create('file:///dir/test-1.css', 'bar', 1, 'a {}'),
		});
		await onDidOpenHandler({
			document: TextDocument.create('file:///dir/test-2.css', 'bar', 1, 'a {}'),
		});

		const didChangeConfigurationNotificationHandler = mockContext.notifications.on.mock.calls.find(
			([type]) => type === LSP.DidChangeConfigurationNotification.type,
		)?.[1];

		await didChangeConfigurationNotificationHandler?.();

		await new Promise((resolve) => setImmediate(resolve));

		expect(mockLogger.error).toHaveBeenCalledWith('Error deregistering formatter for document', {
			uri: 'file:///dir/test-1.css',
			error,
		});
		expect(mockLogger.error).toHaveBeenCalledWith('Error deregistering formatter for document', {
			uri: 'file:///dir/test-2.css',
			error,
		});
	});

	test('when formatters were registered, DidChangeWorkspaceFoldersNotification should deregister all registrations', async () => {
		mockContext.__options.validate = ['bar'];
		mockLogger.isDebugEnabled.mockReturnValue(true);

		const mockRegistration = { dispose: jest.fn() };

		mockContext.connection.client.register.mockResolvedValue(mockRegistration);

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await onDidOpenHandler({
			document: TextDocument.create('file:///dir/test-1.css', 'bar', 1, 'a {}'),
		});
		await onDidOpenHandler({
			document: TextDocument.create('file:///dir/test-2.css', 'bar', 1, 'a {}'),
		});

		const didChangeWorkspaceFoldersNotificationHandler =
			mockContext.notifications.on.mock.calls.find(
				([type]) => type === LSP.DidChangeWorkspaceFoldersNotification.type,
			)?.[1];

		await didChangeWorkspaceFoldersNotificationHandler?.();

		expect(mockRegistration.dispose).toHaveBeenCalledTimes(2);
	});

	test('when formatters were registered, if registration rejects, DidChangeWorkspaceFoldersNotification should log an error', async () => {
		const error = new Error('test');

		mockContext.__options.validate = ['bar'];
		mockLogger.isDebugEnabled.mockReturnValue(true);

		mockContext.connection.client.register.mockRejectedValue(error);

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await onDidOpenHandler({
			document: TextDocument.create('file:///dir/test-1.css', 'bar', 1, 'a {}'),
		});
		await onDidOpenHandler({
			document: TextDocument.create('file:///dir/test-2.css', 'bar', 1, 'a {}'),
		});

		const didChangeWorkspaceFoldersNotificationHandler =
			mockContext.notifications.on.mock.calls.find(
				([type]) => type === LSP.DidChangeWorkspaceFoldersNotification.type,
			)?.[1];

		await didChangeWorkspaceFoldersNotificationHandler?.();

		await new Promise((resolve) => setImmediate(resolve));

		expect(mockLogger.error).toHaveBeenCalledWith('Error deregistering formatter for document', {
			uri: 'file:///dir/test-1.css',
			error,
		});
		expect(mockLogger.error).toHaveBeenCalledWith('Error deregistering formatter for document', {
			uri: 'file:///dir/test-2.css',
			error,
		});
	});

	test('with client dynamic registration support, only one formatter should be registered per document', async () => {
		mockContext.__options.validate = ['bar'];

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const document = TextDocument.create('file:///dir/test.css', 'bar', 1, 'a {}');

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];
		const onDidSaveHandler = mockContext.documents.onDidSave.mock.calls[0][0];

		await onDidOpenHandler({ document });
		await onDidSaveHandler({ document });

		expect(mockContext.connection.client.register).toHaveBeenCalledTimes(1);
	});

	test('when a formatter is registered, a notification should be sent', async () => {
		mockContext.__options.validate = ['bar'];

		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await onDidOpenHandler({
			document: TextDocument.create('file:///dir/test.css', 'bar', 1, 'a {}'),
		});

		expect(mockContext.connection.sendNotification).toHaveBeenCalledWith(
			Notification.DidRegisterDocumentFormattingEditProvider,
			{
				uri: 'file:///dir/test.css',
				options: {
					documentSelector: [{ scheme: 'file', pattern: '/dir/test.css' }],
				},
			},
		);
	});

	it('should be disposable', () => {
		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		expect(module).toHaveProperty('dispose');
		expect(module.dispose).toBeInstanceOf(Function);
	});

	it('should set a no-op formatting handler when disposed', async () => {
		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();
		module.dispose();

		const handler = mockContext.connection.onDocumentFormatting.mock.calls[1][0];

		const result = await handler(
			{
				textDocument: { uri: 'file:///dir/test.css' },
				options: {
					tabSize: 4,
					insertSpaces: true,
				},
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.connection.onDocumentFormatting).toHaveBeenCalledTimes(2);
		expect(result).toBeUndefined();
	});

	it('should dispose all handler registrations when disposed', () => {
		const module = new FormatterModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();
		module.dispose();

		const disposables = [
			...mockContext.notifications.on.mock.results,
			...mockContext.commands.on.mock.results,
			...mockContext.documents.onDidOpen.mock.results,
			...mockContext.documents.onDidSave.mock.results,
			...mockContext.documents.onDidClose.mock.results,
			...mockContext.documents.onDidChangeContent.mock.results,
		];

		expect(disposables).toHaveLength(6);

		for (const disposable of disposables) {
			expect(disposable.value.dispose).toHaveBeenCalledTimes(1);
		}
	});
});
