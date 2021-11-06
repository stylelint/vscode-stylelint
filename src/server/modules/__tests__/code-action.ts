import { CodeActionKind, Position, TextEdit } from 'vscode-languageserver-types';
import type winston from 'winston';
import { CodeActionKind as StylelintCodeActionKind } from '../../types';
import type { LanguageServerModuleConstructorParameters } from '../../types';

import { CodeActionModule } from '../code-action';

const mockContext = {
	connection: { onCodeAction: jest.fn() },
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

describe('CodeActionModule', () => {
	beforeEach(() => {
		mockContext.options.validate = [];
		jest.clearAllMocks();
	});

	test('should be constructable', () => {
		expect(() => new CodeActionModule(getParams())).not.toThrow();
	});

	test('onInitialize should return results', () => {
		const module = new CodeActionModule(getParams());

		expect(module.onInitialize()).toMatchSnapshot();
	});

	test('onDidRegisterHandlers should register a code action handler', () => {
		const module = new CodeActionModule(getParams());

		module.onDidRegisterHandlers();

		expect(mockContext.connection.onCodeAction).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.onCodeAction).toHaveBeenCalledWith(expect.any(Function));
	});

	test('with action kind CodeActionKind.Source, should create code actions', async () => {
		mockContext.documents.get.mockReturnValue({
			uri: 'foo',
			languageId: 'bar',
		});
		mockContext.options.validate = ['bar'];
		mockContext.getFixes.mockReturnValue([TextEdit.insert(Position.create(0, 0), 'text')]);

		const module = new CodeActionModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler({
			context: { only: [CodeActionKind.Source] },
			textDocument: { uri: 'foo' },
		});

		expect(result).toMatchSnapshot();
		expect(mockContext.getFixes).toHaveBeenCalledWith({
			languageId: 'bar',
			uri: 'foo',
		});
	});

	test('with action kind StylelintCodeActionKind.StylelintSourceFixAll, should create code actions', async () => {
		mockContext.documents.get.mockReturnValue({
			uri: 'foo',
			languageId: 'bar',
		});
		mockContext.options.validate = ['bar'];
		mockContext.getFixes.mockReturnValue([TextEdit.insert(Position.create(0, 0), 'text')]);

		const module = new CodeActionModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler({
			context: { only: [StylelintCodeActionKind.StylelintSourceFixAll] },
			textDocument: { uri: 'foo' },
		});

		expect(result).toMatchSnapshot();
		expect(mockContext.getFixes).toHaveBeenCalledWith({
			languageId: 'bar',
			uri: 'foo',
		});
	});

	test('with action kind CodeActionKind.SourceFixAll, should create code actions', async () => {
		mockContext.documents.get.mockReturnValue({
			uri: 'foo',
			languageId: 'bar',
		});
		mockContext.options.validate = ['bar'];
		mockContext.getFixes.mockReturnValue([TextEdit.insert(Position.create(0, 0), 'text')]);

		const module = new CodeActionModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler({
			context: { only: [CodeActionKind.SourceFixAll] },
			textDocument: { uri: 'foo' },
		});

		expect(result).toMatchSnapshot();
		expect(mockContext.getFixes).toHaveBeenCalledWith({
			languageId: 'bar',
			uri: 'foo',
		});
	});

	test('with no action kind, should not attempt to create actions', async () => {
		const module = new CodeActionModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler({
			context: {},
			textDocument: { uri: 'foo' },
		});

		expect(result).toStrictEqual([]);
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Unsupported code action kind, ignoring', {
			kind: undefined,
		});
	});

	test('with incorrect action kind, should not attempt to create actions', async () => {
		const module = new CodeActionModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler({
			context: {
				only: ['foo'],
			},
			textDocument: { uri: 'foo' },
		});

		expect(result).toStrictEqual([]);
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Unsupported code action kind, ignoring', {
			kind: 'foo',
		});
	});

	test('if no matching document exists, should not attempt to create actions', async () => {
		mockContext.documents.get.mockReturnValue(undefined);

		const module = new CodeActionModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler({
			context: { only: [CodeActionKind.Source] },
			textDocument: { uri: 'foo' },
		});

		expect(result).toStrictEqual([]);
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Unknown document, ignoring', { uri: 'foo' });
	});

	test('if document language ID is not in options, should not attempt to create actions', async () => {
		mockContext.documents.get.mockReturnValue({
			uri: 'foo',
			languageId: 'bar',
		});
		mockContext.options.validate = ['baz'];

		const module = new CodeActionModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler({
			context: { only: [CodeActionKind.Source] },
			textDocument: { uri: 'foo' },
		});

		expect(result).toStrictEqual([]);
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Document should not be validated, ignoring',
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

		const module = new CodeActionModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler({
			context: { only: [CodeActionKind.Source] },
			textDocument: { uri: 'foo' },
		});

		expect(result).toStrictEqual([]);
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Received onCodeAction', {
			context: { only: [CodeActionKind.Source] },
			uri: 'foo',
		});
	});
});
