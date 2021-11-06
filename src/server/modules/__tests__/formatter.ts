import { DocumentFormattingRequest } from 'vscode-languageserver-protocol';
import type LSP from 'vscode-languageserver-protocol';
import { Position, TextEdit } from 'vscode-languageserver-types';
import type winston from 'winston';
import type { LanguageServerModuleConstructorParameters } from '../../types';

import { Notification } from '../../types';
import { FormatterModule } from '../formatter';

const mockContext = {
	connection: {
		onDocumentFormatting: jest.fn(),
		sendNotification: jest.fn(),
		client: { register: jest.fn() },
	},
	documents: { get: jest.fn() },
	options: { validate: [] as string[] },
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
		mockContext.options.validate = [];
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
		mockContext.options.validate = ['bar'];
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
		mockContext.options.validate = ['baz'];

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
		mockContext.options.validate = ['baz'];
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

	test("with no debug log level, onDidChangeValidateLanguages shouldn't log languages", async () => {
		mockLogger.isDebugEnabled.mockReturnValue(false);
		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		await module.onDidChangeValidateLanguages({
			languages: new Set(['foo']),
			removedLanguages: new Set(),
		});

		expect(mockLogger.debug).not.toHaveBeenCalledWith('Received onDidChangeValidateLanguages');
		expect(mockLogger.debug).not.toHaveBeenCalledWith('Registering formatter for languages');
	});

	test("without client dynamic registration support, onDidChangeValidateLanguages shouldn't register a formatter", async () => {
		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: false },
				},
			},
		} as unknown as LSP.InitializeParams);

		await module.onDidChangeValidateLanguages({
			languages: new Set(['foo']),
			removedLanguages: new Set(),
		});

		expect(mockContext.connection.client.register).not.toHaveBeenCalled();
	});

	test('with client dynamic registration support, onDidChangeValidateLanguages should register a formatter', async () => {
		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		await module.onDidChangeValidateLanguages({
			languages: new Set(['foo']),
			removedLanguages: new Set(),
		});

		expect(mockContext.connection.client.register).toHaveBeenCalledWith(
			DocumentFormattingRequest.type,
			{ documentSelector: [{ language: 'foo' }] },
		);
	});

	test('when a formatter is registered, a notification should be sent', async () => {
		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		await module.onDidChangeValidateLanguages({
			languages: new Set(['foo']),
			removedLanguages: new Set(),
		});

		expect(mockContext.connection.sendNotification).toHaveBeenCalledWith(
			Notification.DidRegisterDocumentFormattingEditProvider,
			{},
		);
	});

	test('without languages to validate, onDidChangeValidateLanguages should register a formatter', async () => {
		const module = new FormatterModule(getParams(true));

		module.onInitialize({
			capabilities: {
				textDocument: {
					formatting: { dynamicRegistration: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		await module.onDidChangeValidateLanguages({
			languages: new Set(),
			removedLanguages: new Set(),
		});

		expect(mockContext.connection.client.register).not.toHaveBeenCalled();
	});

	test('when a formatter was already registered, onDidChangeValidateLanguages should dispose the old registration', async () => {
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

		await module.onDidChangeValidateLanguages({
			languages: new Set(['foo']),
			removedLanguages: new Set(),
		});

		await module.onDidChangeValidateLanguages({
			languages: new Set(['bar']),
			removedLanguages: new Set(['foo']),
		});

		expect(mockRegistration.dispose).toHaveBeenCalled();
	});
});
