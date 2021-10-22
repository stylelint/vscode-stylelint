'use strict';

const { Range } = require('vscode-languageserver-types');
const { ValidatorModule } = require('../validator');

const mockContext = {
	connection: {
		onDidChangeWatchedFiles: jest.fn(),
		sendDiagnostics: jest.fn(),
	},
	documents: {
		all: jest.fn(),
		onDidChangeContent: jest.fn(),
		onDidClose: jest.fn(),
	},
	options: { validate: /** @type {string[]} */ ([]) },
	displayError: jest.fn(),
	lintDocument: jest.fn(),
};

const mockLogger = /** @type {jest.Mocked<winston.Logger>} */ (
	/** @type {any} */ ({
		debug: jest.fn(),
		error: jest.fn(),
		isDebugEnabled: jest.fn(() => true),
	})
);

const getParams = (passLogger = false) =>
	/** @type {LanguageServerModuleConstructorParameters} */ (
		/** @type {any} */
		({
			context: mockContext,
			logger: passLogger ? mockLogger : undefined,
		})
	);

describe('ValidatorModule', () => {
	beforeEach(() => {
		mockContext.options.validate = [];
		jest.clearAllMocks();
	});

	test('should be constructable', () => {
		expect(() => new ValidatorModule(getParams())).not.toThrow();
	});

	test('onDidRegisterHandlers should register handlers', () => {
		const module = new ValidatorModule(getParams());

		module.onDidRegisterHandlers();

		expect(mockContext.connection.onDidChangeWatchedFiles).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.onDidChangeWatchedFiles).toHaveBeenCalledWith(
			expect.any(Function),
		);
		expect(mockContext.documents.onDidChangeContent).toHaveBeenCalledTimes(1);
		expect(mockContext.documents.onDidChangeContent).toHaveBeenCalledWith(expect.any(Function));
		expect(mockContext.documents.onDidClose).toHaveBeenCalledTimes(1);
		expect(mockContext.documents.onDidClose).toHaveBeenCalledWith(expect.any(Function));
	});

	test('if document language ID is not in options, should not validate', async () => {
		mockContext.options.validate = ['baz'];

		const module = new ValidatorModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.lintDocument).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Document should not be validated, ignoring',
			{ uri: 'foo', language: 'bar' },
		);
	});

	test('if linting produces no results, should not validate', async () => {
		mockContext.options.validate = ['bar'];

		const module = new ValidatorModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.lintDocument).toHaveBeenCalledTimes(1);
		expect(mockLogger.debug).toHaveBeenLastCalledWith('No lint result, ignoring', { uri: 'foo' });
	});

	test('if linting produces results, should forward diagnostics to client', async () => {
		mockContext.options.validate = ['bar'];
		mockContext.lintDocument.mockResolvedValueOnce({
			diagnostics: [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(4, 5, 1, 4),
				},
			],
		});

		const module = new ValidatorModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.lintDocument).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledWith({
			uri: 'foo',
			diagnostics: [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(4, 5, 1, 4),
				},
			],
		});
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Diagnostics sent', { uri: 'foo' });
	});

	test('if sending diagnostics fails, should display the error', async () => {
		const error = new Error('foo');

		mockContext.options.validate = ['bar'];
		mockContext.lintDocument.mockResolvedValueOnce({
			diagnostics: [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(4, 5, 1, 4),
				},
			],
		});
		mockContext.connection.sendDiagnostics.mockImplementationOnce(() => {
			throw error;
		});

		const module = new ValidatorModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.lintDocument).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledWith({
			uri: 'foo',
			diagnostics: [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(4, 5, 1, 4),
				},
			],
		});
		expect(mockContext.displayError).toHaveBeenCalledTimes(1);
		expect(mockContext.displayError).toHaveBeenCalledWith(error);
		expect(mockLogger.error).toHaveBeenLastCalledWith('Failed to send diagnostics', {
			uri: 'foo',
			error,
		});
	});

	test('onInitialize should validate all documents', async () => {
		mockContext.options.validate = ['baz'];
		mockContext.lintDocument.mockImplementation((document) => {
			return document.uri === 'foo'
				? {
						diagnostics: [
							{
								code: 'indentation',
								message: 'Expected indentation of 4 spaces',
								range: Range.create(4, 5, 1, 4),
							},
						],
				  }
				: {
						diagnostics: [
							{
								code: 'color-hex-case',
								message: 'Expected "#CCC" to be "#ccc"',
								range: Range.create(2, 2, 2, 6),
							},
						],
				  };
		});
		mockContext.documents.all.mockReturnValueOnce([
			{ uri: 'foo', languageId: 'baz' },
			{ uri: 'bar', languageId: 'baz' },
		]);

		const module = new ValidatorModule(getParams(true));

		module.onInitialize();

		// Wait for async validation to complete
		await new Promise((resolve) => setImmediate(resolve));

		expect(mockContext.lintDocument).toHaveBeenCalledTimes(2);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledTimes(2);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledWith({
			uri: 'foo',
			diagnostics: [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(4, 5, 1, 4),
				},
			],
		});
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledWith({
			uri: 'bar',
			diagnostics: [
				{
					code: 'color-hex-case',
					message: 'Expected "#CCC" to be "#ccc"',
					range: Range.create(2, 2, 2, 6),
				},
			],
		});
		expect(mockLogger.debug).toHaveBeenCalledWith('Diagnostics sent', { uri: 'foo' });
		expect(mockLogger.debug).toHaveBeenCalledWith('Diagnostics sent', { uri: 'bar' });
	});

	test('onDidChangeWatchedFiles should validate all documents', async () => {
		mockContext.options.validate = ['baz'];
		mockContext.lintDocument.mockImplementation((document) => {
			return document.uri === 'foo'
				? {
						diagnostics: [
							{
								code: 'indentation',
								message: 'Expected indentation of 4 spaces',
								range: Range.create(4, 5, 1, 4),
							},
						],
				  }
				: {
						diagnostics: [
							{
								code: 'color-hex-case',
								message: 'Expected "#CCC" to be "#ccc"',
								range: Range.create(2, 2, 2, 6),
							},
						],
				  };
		});
		mockContext.documents.all.mockReturnValueOnce([
			{ uri: 'foo', languageId: 'baz' },
			{ uri: 'bar', languageId: 'baz' },
		]);

		const module = new ValidatorModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onDidChangeWatchedFiles.mock.calls[0][0];

		await handler();

		expect(mockContext.lintDocument).toHaveBeenCalledTimes(2);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledTimes(2);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledWith({
			uri: 'foo',
			diagnostics: [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(4, 5, 1, 4),
				},
			],
		});
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledWith({
			uri: 'bar',
			diagnostics: [
				{
					code: 'color-hex-case',
					message: 'Expected "#CCC" to be "#ccc"',
					range: Range.create(2, 2, 2, 6),
				},
			],
		});
		expect(mockLogger.debug).toHaveBeenCalledWith('Diagnostics sent', { uri: 'foo' });
		expect(mockLogger.debug).toHaveBeenCalledWith('Diagnostics sent', { uri: 'bar' });
	});

	test('onDidChangeConfiguration should validate all documents', async () => {
		mockContext.options.validate = ['baz'];
		mockContext.lintDocument.mockImplementation((document) => {
			return document.uri === 'foo'
				? {
						diagnostics: [
							{
								code: 'indentation',
								message: 'Expected indentation of 4 spaces',
								range: Range.create(4, 5, 1, 4),
							},
						],
				  }
				: {
						diagnostics: [
							{
								code: 'color-hex-case',
								message: 'Expected "#CCC" to be "#ccc"',
								range: Range.create(2, 2, 2, 6),
							},
						],
				  };
		});
		mockContext.documents.all.mockReturnValueOnce([
			{ uri: 'foo', languageId: 'baz' },
			{ uri: 'bar', languageId: 'baz' },
		]);

		const module = new ValidatorModule(getParams(true));

		await module.onDidChangeConfiguration();

		expect(mockContext.lintDocument).toHaveBeenCalledTimes(2);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledTimes(2);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledWith({
			uri: 'foo',
			diagnostics: [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(4, 5, 1, 4),
				},
			],
		});
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledWith({
			uri: 'bar',
			diagnostics: [
				{
					code: 'color-hex-case',
					message: 'Expected "#CCC" to be "#ccc"',
					range: Range.create(2, 2, 2, 6),
				},
			],
		});
		expect(mockLogger.debug).toHaveBeenCalledWith('Diagnostics sent', { uri: 'foo' });
		expect(mockLogger.debug).toHaveBeenCalledWith('Diagnostics sent', { uri: 'bar' });
	});

	test('getDiagnostics should return cached diagnostics per document', async () => {
		mockContext.options.validate = ['bar'];
		const diagnostics = [
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(4, 5, 1, 4),
			},
		];

		mockContext.lintDocument.mockResolvedValueOnce({ diagnostics });

		const module = new ValidatorModule(getParams(true));

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		const cached = module.getDiagnostics('foo');

		expect(cached).toStrictEqual(diagnostics);
		expect(mockContext.lintDocument).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledWith({
			uri: 'foo',
			diagnostics,
		});
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Diagnostics sent', { uri: 'foo' });
	});

	test('onDidClose should clear diagnostics', async () => {
		mockContext.options.validate = ['bar'];
		const diagnostics = [
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(4, 5, 1, 4),
			},
		];

		mockContext.lintDocument.mockResolvedValueOnce({ diagnostics });

		const module = new ValidatorModule(getParams(true));

		module.onDidRegisterHandlers();

		const onDidChangeContentHandler = mockContext.documents.onDidChangeContent.mock.calls[0][0];
		const onDidCloseHandler = mockContext.documents.onDidClose.mock.calls[0][0];

		await onDidChangeContentHandler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		onDidCloseHandler({ document: { uri: 'foo', languageId: 'bar' } });

		const cached = module.getDiagnostics('foo');

		expect(cached).toStrictEqual([]);
		expect(mockContext.lintDocument).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledTimes(2);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenNthCalledWith(1, {
			uri: 'foo',
			diagnostics,
		});
		expect(mockContext.connection.sendDiagnostics).toHaveBeenLastCalledWith({
			uri: 'foo',
			diagnostics: [],
		});
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Diagnostics cleared', { uri: 'foo' });
	});

	test("with no debug log level, onDidChangeValidateLanguages shouldn't log languages", () => {
		mockLogger.isDebugEnabled.mockReturnValue(false);
		mockContext.documents.all.mockReturnValueOnce([]);
		const module = new ValidatorModule(getParams(true));

		module.onDidChangeValidateLanguages({
			languages: new Set(['foo']),
			removedLanguages: new Set(),
		});

		expect(mockLogger.debug).not.toHaveBeenCalledWith('Received onDidChangeValidateLanguages');
		expect(mockLogger.debug).not.toHaveBeenCalledWith('Registering formatter for languages');
	});

	test('with debug log level, onDidChangeValidateLanguages should log languages', () => {
		mockLogger.isDebugEnabled.mockReturnValue(true);
		mockContext.documents.all.mockReturnValueOnce([]);
		const module = new ValidatorModule(getParams(true));

		module.onDidChangeValidateLanguages({
			languages: new Set(['foo']),
			removedLanguages: new Set(),
		});

		expect(mockLogger.debug).toHaveBeenLastCalledWith('Received onDidChangeValidateLanguages', {
			removedLanguages: [],
		});
	});

	test('when languages are removed, onDidChangeValidateLanguages should clear diagnostics for documents of those languages', async () => {
		mockContext.options.validate = ['baz', 'qux'];
		mockContext.lintDocument.mockImplementation((document) => {
			return document.uri === 'foo'
				? {
						diagnostics: [
							{
								code: 'indentation',
								message: 'Expected indentation of 4 spaces',
								range: Range.create(4, 5, 1, 4),
							},
						],
				  }
				: {
						diagnostics: [
							{
								code: 'color-hex-case',
								message: 'Expected "#CCC" to be "#ccc"',
								range: Range.create(2, 2, 2, 6),
							},
						],
				  };
		});
		mockContext.documents.all.mockReturnValue([
			{ uri: 'foo', languageId: 'baz' },
			{ uri: 'bar', languageId: 'qux' },
		]);

		const module = new ValidatorModule(getParams(true));

		await module.onDidChangeConfiguration();

		module.onDidChangeValidateLanguages({
			languages: new Set(['qux']),
			removedLanguages: new Set(['baz']),
		});

		expect(mockContext.lintDocument).toHaveBeenCalledTimes(2);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledTimes(3);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledWith({
			uri: 'foo',
			diagnostics: [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(4, 5, 1, 4),
				},
			],
		});
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledWith({
			uri: 'bar',
			diagnostics: [
				{
					code: 'color-hex-case',
					message: 'Expected "#CCC" to be "#ccc"',
					range: Range.create(2, 2, 2, 6),
				},
			],
		});
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledWith({
			uri: 'foo',
			diagnostics: [],
		});
		expect(mockLogger.debug).toHaveBeenCalledWith('Diagnostics cleared', { uri: 'foo' });
	});
});
