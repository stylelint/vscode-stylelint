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

import * as LSP from 'vscode-languageserver-protocol';
import { Position, TextEdit } from 'vscode-languageserver-types';
import type winston from 'winston';
import type { LanguageServerOptions, LanguageServerModuleConstructorParameters } from '../../types';

import { Notification } from '../../types';
import { FormatterModule } from '../formatter';

const mockOptions: LanguageServerOptions = {
	codeAction: {
		disableRuleComment: {
			location: 'separateLine',
		},
	},
	packageManager: 'npm',
	validate: [],
	snippet: [],
};

const mockContext = {
	connection: {
		onDocumentFormatting: jest.fn(),
		onNotification: jest.fn(),
		sendNotification: jest.fn(),
		client: { register: jest.fn() },
	},
	documents: {
		get: jest.fn(),
		onDidOpen: jest.fn(),
		onDidChangeContent: jest.fn(),
		onDidClose: jest.fn(),
		onDidSave: jest.fn(),
	},
	getOptions: jest.fn(async () => mockOptions),
	getFixes: jest.fn(),
};

const mockLogger = {
	debug: jest.fn(),
	isDebugEnabled: jest.fn(() => true),
} as unknown as jest.Mocked<winston.Logger>;

const getParams = (passLogger = false) =>
	({
		context: mockContext,
		logger: passLogger ? mockLogger : undefined,
	} as unknown as LanguageServerModuleConstructorParameters);

describe('FormatterModule', () => {
	beforeEach(() => {
		mockOptions.validate = [];
		jest.clearAllMocks();
	});

	test('should be constructable', () => {
		expect(() => new FormatterModule(getParams())).not.toThrow();
	});

	test('without client dynamic registration support, onInitialize should request static registration', () => {
		const module = new FormatterModule(getParams());

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
		const module = new FormatterModule(getParams());

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
		const module = new FormatterModule(getParams());

		module.onDidRegisterHandlers();

		expect(mockContext.connection.onDocumentFormatting).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.onDocumentFormatting).toHaveBeenCalledWith(expect.any(Function));
	});

	test('should format documents', async () => {
		mockContext.documents.get.mockReturnValue({
			uri: 'foo',
			languageId: 'bar',
		});
		mockOptions.validate = ['bar'];
		mockContext.getFixes.mockReturnValue([TextEdit.insert(Position.create(0, 0), 'text')]);

		const module = new FormatterModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onDocumentFormatting.mock.calls[0][0];

		const result = await handler({
			textDocument: { uri: 'foo' },
			options: {
				insertSpaces: true,
				tabSize: 2,
				insertFinalNewline: true,
				trimFinalNewlines: false,
			},
		});

		expect(result).toMatchSnapshot();
		expect(mockContext.getFixes.mock.calls[0]).toMatchSnapshot();
		expect(mockContext.getFixes.mock.results[0].value).toStrictEqual(result);
	});

	test('with incorrect command, should not attempt to format', async () => {
		const module = new FormatterModule(getParams());

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onDocumentFormatting.mock.calls[0][0];

		const result = await handler({ command: 'foo' });

		expect(result).toBeNull();
		expect(mockContext.getFixes).not.toHaveBeenCalled();
	});

	test('with no text document, should not attempt to format', async () => {
		const module = new FormatterModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onDocumentFormatting.mock.calls[0][0];

		const result = await handler({ options: {} });

		expect(result).toBeNull();
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('No text document provided, ignoring');
	});

	test('if no matching document exists, should not attempt to format', async () => {
		mockContext.documents.get.mockReturnValue(undefined);

		const module = new FormatterModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onDocumentFormatting.mock.calls[0][0];

		const result = await handler({
			textDocument: { uri: 'foo' },
			options: {},
		});

		expect(result).toBeNull();
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Unknown document, ignoring', { uri: 'foo' });
	});

	test('if document language ID is not in options, should not attempt to format', async () => {
		mockContext.documents.get.mockReturnValue({
			uri: 'foo',
			languageId: 'bar',
		});
		mockOptions.validate = ['baz'];

		const module = new FormatterModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onDocumentFormatting.mock.calls[0][0];

		const result = await handler({
			textDocument: { uri: 'foo' },
			options: {},
		});

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
		mockContext.documents.get.mockReturnValue({
			uri: 'foo',
			languageId: 'bar',
		});
		mockOptions.validate = ['baz'];
		mockLogger.isDebugEnabled.mockReturnValue(false);

		const module = new FormatterModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onDocumentFormatting.mock.calls[0][0];

		const handlerParams = {
			textDocument: { uri: 'foo' },
			options: {},
		};

		const result = await handler(handlerParams);

		expect(result).toBeNull();
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Received onDocumentFormatting',
			handlerParams,
		);
	});

	test("without client dynamic registration support, documents.onDidOpen shouldn't register a formatter", async () => {
		mockOptions.validate = ['bar'];

		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: false },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await onDidOpenHandler({ document: { uri: 'foo', languageId: 'bar' } });

		expect(mockContext.connection.client.register).not.toHaveBeenCalled();
	});

	test("without client dynamic registration support, documents.onDidChangeContent shouldn't register a formatter", async () => {
		mockOptions.validate = ['bar'];

		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: false },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidChangeContentHandler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await onDidChangeContentHandler({ document: { uri: 'foo', languageId: 'bar' } });

		expect(mockContext.connection.client.register).not.toHaveBeenCalled();
	});

	test("without client dynamic registration support, documents.onDidSave shouldn't register a formatter", async () => {
		mockOptions.validate = ['bar'];

		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: false },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidSaveHandler = mockContext.documents.onDidSave.mock.calls[0][0];

		await onDidSaveHandler({ document: { uri: 'foo', languageId: 'bar' } });

		expect(mockContext.connection.client.register).not.toHaveBeenCalled();
	});

	test('with client dynamic registration support, documents.onDidOpen should register a formatter', async () => {
		mockOptions.validate = ['bar'];

		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await onDidOpenHandler({ document: { uri: 'file:///dir/test.css', languageId: 'bar' } });
		await onDidOpenHandler({ document: { uri: 'scheme:///dir/test.css', languageId: 'bar' } });

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
		mockOptions.validate = ['bar'];

		const module = new FormatterModule(getParams(true));

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
			document: { uri: 'file:///dir/test.css', languageId: 'bar' },
		});

		expect(mockContext.connection.client.register).toHaveBeenCalledWith(
			LSP.DocumentFormattingRequest.type,
			{ documentSelector: [{ scheme: 'file', pattern: '/dir/test.css' }] },
		);
	});

	test('with client dynamic registration support, documents.onDidSave should register a formatter', async () => {
		mockOptions.validate = ['bar'];

		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidSaveHandler = mockContext.documents.onDidSave.mock.calls[0][0];

		await onDidSaveHandler({ document: { uri: 'file:///dir/test.css', languageId: 'bar' } });

		expect(mockContext.connection.client.register).toHaveBeenCalledWith(
			LSP.DocumentFormattingRequest.type,
			{ documentSelector: [{ scheme: 'file', pattern: '/dir/test.css' }] },
		);
	});

	test('when a formatter was registered, documents.onDidClose should dispose the old registration', async () => {
		mockOptions.validate = ['bar'];
		mockLogger.isDebugEnabled.mockReturnValue(true);

		const mockRegistration = { dispose: jest.fn() };

		mockContext.connection.client.register.mockResolvedValueOnce(mockRegistration);

		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];
		const onDidCloseHandler = mockContext.documents.onDidClose.mock.calls[0][0];

		await onDidOpenHandler({ document: { uri: 'file:///dir/test.css', languageId: 'bar' } });
		await onDidCloseHandler({ document: { uri: 'file:///dir/test.css' } });

		expect(mockRegistration.dispose).toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenCalledWith('Deregistering formatter for document', {
			uri: 'file:///dir/test.css',
		});
	});

	test('when a formatter was not registered, documents.onDidClose should not try to dispose a registration', async () => {
		mockOptions.validate = ['bar'];
		mockLogger.isDebugEnabled.mockReturnValue(true);

		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidCloseHandler = mockContext.documents.onDidClose.mock.calls[0][0];

		await onDidCloseHandler({ document: { uri: 'file:///dir/test.css' } });

		expect(mockLogger.debug).not.toHaveBeenCalledWith('Deregistering formatter for document', {
			uri: 'file:///dir/test.css',
		});
	});

	test('when formatters were registered, DidChangeConfigurationNotification should deregister all registrations', async () => {
		mockOptions.validate = ['bar'];
		mockLogger.isDebugEnabled.mockReturnValue(true);

		const mockRegistration = { dispose: jest.fn() };

		mockContext.connection.client.register.mockResolvedValue(mockRegistration);

		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await onDidOpenHandler({ document: { uri: 'file:///dir/test-1.css', languageId: 'bar' } });
		await onDidOpenHandler({ document: { uri: 'file:///dir/test-2.css', languageId: 'bar' } });

		const didChangeConfigurationNotificationHandler =
			mockContext.connection.onNotification.mock.calls.find(
				(call) => call[0] === LSP.DidChangeConfigurationNotification.type,
			)[1];

		await didChangeConfigurationNotificationHandler();

		expect(mockRegistration.dispose).toHaveBeenCalledTimes(2);
	});

	test('when formatters were registered, DidChangeWorkspaceFoldersNotification should deregister all registrations', async () => {
		mockOptions.validate = ['bar'];
		mockLogger.isDebugEnabled.mockReturnValue(true);

		const mockRegistration = { dispose: jest.fn() };

		mockContext.connection.client.register.mockResolvedValue(mockRegistration);

		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await onDidOpenHandler({ document: { uri: 'file:///dir/test-1.css', languageId: 'bar' } });
		await onDidOpenHandler({ document: { uri: 'file:///dir/test-2.css', languageId: 'bar' } });

		const didChangeWorkspaceFoldersNotificationHandler =
			mockContext.connection.onNotification.mock.calls.find(
				(call) => call[0] === LSP.DidChangeWorkspaceFoldersNotification.type,
			)[1];

		await didChangeWorkspaceFoldersNotificationHandler();

		expect(mockRegistration.dispose).toHaveBeenCalledTimes(2);
	});

	test('with client dynamic registration support, only one formatter should be registered per document', async () => {
		mockOptions.validate = ['bar'];

		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];
		const onDidSaveHandler = mockContext.documents.onDidSave.mock.calls[0][0];

		await onDidOpenHandler({ document: { uri: 'file:///dir/test.css', languageId: 'bar' } });
		await onDidSaveHandler({ document: { uri: 'file:///dir/test.css', languageId: 'bar' } });

		expect(mockContext.connection.client.register).toHaveBeenCalledTimes(1);
	});

	test('when a formatter is registered, a notification should be sent', async () => {
		mockOptions.validate = ['bar'];

		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const onDidOpenHandler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await onDidOpenHandler({ document: { uri: 'file:///dir/test.css', languageId: 'bar' } });

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
});
