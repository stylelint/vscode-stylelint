import { DidChangeWatchedFilesNotification } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Range } from 'vscode-languageserver-types';
import { ValidatorModule } from '../validator';

const mockContext = serverMocks.getContext();
const mockLogger = serverMocks.getLogger();

describe('ValidatorModule', () => {
	beforeEach(() => {
		mockContext.__options.validate = [];
		jest.clearAllMocks();
	});

	test('should be constructable', () => {
		expect(() => new ValidatorModule({ context: mockContext.__typed() })).not.toThrow();
	});

	test('onDidRegisterHandlers should register handlers', () => {
		const module = new ValidatorModule({ context: mockContext.__typed() });

		module.onDidRegisterHandlers();

		expect(mockContext.notifications.on).toHaveBeenCalledTimes(1);
		expect(mockContext.notifications.on).toHaveBeenCalledWith(
			DidChangeWatchedFilesNotification.type,
			expect.any(Function),
		);
		expect(mockContext.documents.onDidChangeContent).toHaveBeenCalledTimes(1);
		expect(mockContext.documents.onDidChangeContent).toHaveBeenCalledWith(expect.any(Function));
		expect(mockContext.documents.onDidClose).toHaveBeenCalledTimes(1);
		expect(mockContext.documents.onDidClose).toHaveBeenCalledWith(expect.any(Function));
	});

	test('if document language ID is not in options, should not validate', async () => {
		mockContext.__options.validate = ['baz'];

		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
		});

		expect(mockContext.lintDocument).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Document should not be validated, ignoring',
			{ uri: 'foo', language: 'bar' },
		);
	});

	test('if linting produces no results, should not validate', async () => {
		mockContext.__options.validate = ['bar'];

		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
		});

		expect(mockContext.lintDocument).toHaveBeenCalledTimes(1);
		expect(mockLogger.debug).toHaveBeenLastCalledWith('No lint result, ignoring', { uri: 'foo' });
	});

	test('if linting produces results, should forward diagnostics to client', async () => {
		mockContext.__options.validate = ['bar'];
		mockContext.lintDocument.mockResolvedValueOnce({
			diagnostics: [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(4, 5, 1, 4),
				},
			],
		});

		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
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

		mockContext.__options.validate = ['bar'];
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

		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
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
		mockContext.__options.validate = ['baz'];
		mockContext.lintDocument.mockImplementation(async (document) => {
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
			TextDocument.create('foo', 'baz', 1, 'a {}'),
			TextDocument.create('bar', 'baz', 1, 'a {}'),
		]);

		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

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
		mockContext.__options.validate = ['baz'];
		mockContext.lintDocument.mockImplementation(async (document) => {
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
			TextDocument.create('foo', 'baz', 1, 'a {}'),
			TextDocument.create('bar', 'baz', 1, 'a {}'),
		]);

		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.notifications.on.mock.calls.find(
			([type]) => type === DidChangeWatchedFilesNotification.type,
		)?.[1];

		await handler?.();

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
		mockContext.__options.validate = ['baz'];
		mockContext.lintDocument.mockImplementation(async (document) => {
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
			TextDocument.create('foo', 'baz', 1, 'a {}'),
			TextDocument.create('bar', 'baz', 1, 'a {}'),
		]);

		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

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
		mockContext.__options.validate = ['bar'];
		const diagnostics = [
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(4, 5, 1, 4),
			},
		];

		mockContext.lintDocument.mockResolvedValueOnce({ diagnostics });

		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidChangeContent.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
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
		mockContext.__options.validate = ['bar'];
		const diagnostics = [
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(4, 5, 1, 4),
			},
		];

		mockContext.lintDocument.mockResolvedValueOnce({ diagnostics });

		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const document = TextDocument.create('foo', 'bar', 1, 'a {}');

		const onDidChangeContentHandler = mockContext.documents.onDidChangeContent.mock.calls[0][0];
		const onDidCloseHandler = mockContext.documents.onDidClose.mock.calls[0][0];

		await onDidChangeContentHandler({ document });
		onDidCloseHandler({ document });

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

		// Flush all promises
		// eslint-disable-next-line jest/unbound-method, n/prefer-global/process
		await new Promise(process.nextTick);
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Diagnostics cleared', { uri: 'foo' });
	});

	test('when the configuration is updated, all documents should be revalidated', async () => {
		mockContext.__options.validate = ['baz', 'qux'];
		mockContext.lintDocument.mockImplementation(async (document) => {
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
			TextDocument.create('foo', 'baz', 1, 'a {}'),
			TextDocument.create('bar', 'qux', 1, 'a {}'),
		]);

		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

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
		expect(mockLogger.debug).toHaveBeenCalledWith('Received onDidChangeConfiguration');
	});

	test('when the configuration is updated, documents excluded from new config should have diagnostics cleared', async () => {
		mockContext.__options.validate = ['baz', 'qux'];
		mockContext.lintDocument.mockImplementation(async (document) => {
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
			TextDocument.create('foo', 'baz', 1, 'a {}'),
			TextDocument.create('bar', 'qux', 1, 'a {}'),
		]);

		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

		await module.onDidChangeConfiguration();

		mockContext.__options.validate = ['baz'];

		await module.onDidChangeConfiguration();

		expect(mockContext.lintDocument).toHaveBeenCalledTimes(3);
		expect(mockContext.connection.sendDiagnostics).toHaveBeenCalledTimes(4);
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
			uri: 'bar',
			diagnostics: [],
		});
		expect(mockLogger.debug).toHaveBeenCalledWith(
			'Document should not be validated, clearing diagnostics',
			{
				uri: 'bar',
				language: 'qux',
			},
		);
	});

	it('should be disposable', () => {
		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

		expect(module).toHaveProperty('dispose');
		expect(module.dispose).toBeInstanceOf(Function);
	});

	it('should dispose all handler registrations when disposed', () => {
		const module = new ValidatorModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();
		module.dispose();

		const disposables = [
			...mockContext.notifications.on.mock.results,
			...mockContext.documents.onDidClose.mock.results,
			...mockContext.documents.onDidChangeContent.mock.results,
		];

		expect(disposables).toHaveLength(3);

		for (const disposable of disposables) {
			expect(disposable.value.dispose).toHaveBeenCalledTimes(1);
		}
	});
});
