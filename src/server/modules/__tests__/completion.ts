import { Position, Range } from 'vscode-languageserver-types';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type LSP from 'vscode-languageserver-protocol';
import { DisableReportRuleNames } from '../../../utils/stylelint/index';

import { CompletionModule } from '../completion';
import { WorkDoneProgressReporter } from 'vscode-languageserver';

const mockContext = serverMocks.getContext();
const mockLogger = serverMocks.getLogger();

const createDocument = (code: string) =>
	TextDocument.create('file:///path/test.css', 'css', 0, code);

const createNeedlessDisableDiagnostic = ({
	rule,
	range,
}: {
	rule: string;
	range: LSP.Range;
}): LSP.Diagnostic => ({
	message: `Needless disable for "${rule}"`,
	range,
	code: DisableReportRuleNames.Needless,
});

describe('CompletionModule', () => {
	beforeEach(() => {
		mockContext.__options.validate = [];
		mockContext.__options.snippet = [];
		jest.clearAllMocks();
	});

	test('should be constructable', () => {
		expect(() => new CompletionModule({ context: mockContext.__typed() })).not.toThrow();
	});

	test('onInitialize should return results', () => {
		const module = new CompletionModule({ context: mockContext.__typed() });

		expect(module.onInitialize()).toMatchSnapshot();
	});

	test('onDidRegisterHandlers should register a completion handler', () => {
		const module = new CompletionModule({ context: mockContext.__typed() });

		module.onDidRegisterHandlers();

		expect(mockContext.connection.onCompletion).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.onCompletion).toHaveBeenCalledWith(expect.any(Function));
	});

	test('if no matching document exists, should not return completions', async () => {
		mockContext.documents.get.mockReturnValue(undefined);

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'foo' },
				position: Position.create(0, 0),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual([]);
		expect(mockContext.getModule).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Unknown document, ignoring', { uri: 'foo' });
	});

	test('if document language ID is not in validate options, should not return completions', async () => {
		mockContext.documents.get.mockReturnValue(TextDocument.create('foo', 'bar', 1, 'a {}'));
		mockContext.__options.validate = ['baz'];
		mockContext.__options.snippet = ['bar'];

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'foo' },
				position: Position.create(0, 0),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual([]);
		expect(mockContext.getModule).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Snippets or validation not enabled for language, ignoring',
			{
				uri: 'foo',
				language: 'bar',
			},
		);
	});

	test('if document language ID is not in snippet options, should not return completions', async () => {
		mockContext.documents.get.mockReturnValue(TextDocument.create('foo', 'bar', 1, 'a {}'));
		mockContext.__options.validate = ['bar'];
		mockContext.__options.snippet = ['baz'];

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'foo' },
				position: Position.create(0, 0),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual([]);
		expect(mockContext.getModule).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Snippets or validation not enabled for language, ignoring',
			{
				uri: 'foo',
				language: 'bar',
			},
		);
	});

	test('with no debug log level and no valid document, should not attempt to log reason', async () => {
		mockContext.documents.get.mockReturnValue(TextDocument.create('foo', 'bar', 1, 'a {}'));
		mockContext.__options.validate = ['bar'];
		mockContext.__options.snippet = ['baz'];
		mockLogger.isDebugEnabled.mockReturnValue(false);

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'foo' },
				position: Position.create(0, 0),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual([]);
		expect(mockContext.getModule).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Received onCompletion', {
			uri: 'foo',
			position: Position.create(0, 0),
		});
	});

	test('without the validator module, should return generic completions', async () => {
		mockContext.documents.get.mockReturnValue(TextDocument.create('foo', 'bar', 1, 'a {}'));
		mockContext.__options.validate = ['bar'];
		mockContext.__options.snippet = ['bar'];
		mockContext.getModule.mockReturnValue(undefined);

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'foo' },
				position: Position.create(0, 0),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.getModule).toHaveBeenCalledTimes(1);
		expect(result).toMatchSnapshot();
	});

	test('without diagnostics, should return generic completions', async () => {
		mockContext.documents.get.mockReturnValue(TextDocument.create('foo', 'bar', 1, 'a {}'));
		mockContext.__options.validate = ['bar'];
		mockContext.__options.snippet = ['bar'];
		mockContext.getModule.mockReturnValue({
			getDiagnostics: () => [],
			dispose: () => undefined,
		});

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'foo' },
				position: Position.create(0, 0),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.getModule).toHaveBeenCalledTimes(1);
		expect(result).toMatchSnapshot();
	});

	test('with no diagnostics at the same or next line, should return generic completions', async () => {
		mockContext.documents.get.mockReturnValue(createDocument('a {\n  color: red;\n}'));
		mockContext.__options.validate = ['css'];
		mockContext.__options.snippet = ['css'];
		mockContext.getModule.mockReturnValue({
			getDiagnostics: () => [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(3, 4, 3, 4),
				},
				{
					code: 5,
					message: 'Not a Stylelint diagnostic',
					range: Range.create(1, 2, 1, 4),
				},
			],
			dispose: () => undefined,
		});

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'file:///path/test.css' },
				position: Position.create(1, 3),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.getModule).toHaveBeenCalledTimes(1);
		expect(result).toMatchSnapshot();
	});

	test('with diagnostics at the same line, should return disable comment completions for rule', async () => {
		mockContext.documents.get.mockReturnValue(createDocument('a {\n  color: red;\n}'));
		mockContext.__options.validate = ['css'];
		mockContext.__options.snippet = ['css'];
		mockContext.getModule.mockReturnValue({
			getDiagnostics: () => [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(1, 2, 3, 4),
				},
			],
			dispose: () => undefined,
		});

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'file:///path/test.css' },
				position: Position.create(1, 3),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.getModule).toHaveBeenCalledTimes(1);
		expect(result).toMatchSnapshot();
	});

	test('with diagnostics at the next line, should return disable comment completions for rule', async () => {
		mockContext.documents.get.mockReturnValue(
			createDocument('a {\n  font-weight: 400;\n  color: red;\n}'),
		);
		mockContext.__options.validate = ['css'];
		mockContext.__options.snippet = ['css'];
		mockContext.getModule.mockReturnValue({
			getDiagnostics: () => [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(2, 1, 3, 4),
				},
			],
			dispose: () => undefined,
		});

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'file:///path/test.css' },
				position: Position.create(1, 3),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.getModule).toHaveBeenCalledTimes(1);
		expect(result).toMatchSnapshot();
	});

	test('with needless disables reported for a diagnostic, should return generic completions', async () => {
		mockContext.documents.get.mockReturnValue(createDocument('a {\n  color: red;\n}'));
		mockContext.__options.validate = ['css'];
		mockContext.__options.snippet = ['css'];
		mockContext.getModule.mockReturnValue({
			getDiagnostics: () => [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(1, 2, 3, 4),
				},
				createNeedlessDisableDiagnostic({
					rule: 'indentation',
					range: Range.create(1, 2, 3, 4),
				}),
			],
			dispose: () => undefined,
		});

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'file:///path/test.css' },
				position: Position.create(1, 3),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.getModule).toHaveBeenCalledTimes(1);
		expect(result).toMatchSnapshot();
	});

	test('with diagnostics at the same line and cursor in a line disable comment, should return rule completions', async () => {
		mockContext.documents.get.mockReturnValue(
			createDocument(`a {
  /* stylelint-disable-line  */
  color: red;
}`),
		);
		mockContext.__options.validate = ['css'];
		mockContext.__options.snippet = ['css'];
		mockContext.getModule.mockReturnValue({
			getDiagnostics: () => [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(1, 2, 3, 4),
				},
			],
			dispose: () => undefined,
		});

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'file:///path/test.css' },
				position: Position.create(1, 28),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.getModule).toHaveBeenCalledTimes(1);
		expect(result).toMatchSnapshot();
	});

	test('with diagnostics at the next line and cursor in a next-line disable comment, should return rule completions', async () => {
		mockContext.documents.get.mockReturnValue(
			createDocument(`a {
  /* stylelint-disable-next-line  */
  color: red;
}`),
		);
		mockContext.__options.validate = ['css'];
		mockContext.__options.snippet = ['css'];
		mockContext.getModule.mockReturnValue({
			getDiagnostics: () => [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(2, 2, 3, 4),
				},
			],
			dispose: () => undefined,
		});

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'file:///path/test.css' },
				position: Position.create(1, 33),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.getModule).toHaveBeenCalledTimes(1);
		expect(result).toMatchSnapshot();
	});

	test('with diagnostics at the next line and cursor in a disable comment, should return rule completions', async () => {
		mockContext.documents.get.mockReturnValue(
			createDocument(`a {
  /* stylelint-disable  */
  color: red;
}`),
		);
		mockContext.__options.validate = ['css'];
		mockContext.__options.snippet = ['css'];
		mockContext.getModule.mockReturnValue({
			getDiagnostics: () => [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(2, 2, 3, 4),
				},
			],
			dispose: () => undefined,
		});

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'file:///path/test.css' },
				position: Position.create(1, 23),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.getModule).toHaveBeenCalledTimes(1);
		expect(result).toMatchSnapshot();
	});

	test('with no diagnostics at same or next line and cursor in a disable comment, should not return completions', async () => {
		mockContext.documents.get.mockReturnValue(
			createDocument(`a {
    /* stylelint-disable  */
    color: red;
  font-weight: 400;
}`),
		);
		mockContext.__options.validate = ['css'];
		mockContext.__options.snippet = ['css'];
		mockContext.getModule.mockReturnValue({
			getDiagnostics: () => [
				{
					code: 'indentation',
					message: 'Expected indentation of 4 spaces',
					range: Range.create(3, 2, 3, 4),
				},
			],
			dispose: () => undefined,
		});

		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCompletion.mock.calls[0][0];

		const result = await handler(
			{
				textDocument: { uri: 'file:///path/test.css' },
				position: Position.create(1, 25),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.getModule).toHaveBeenCalledTimes(1);
		expect(result).toMatchSnapshot();
	});

	it('should be disposable', () => {
		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		expect(module).toHaveProperty('dispose');
		expect(module.dispose).toBeInstanceOf(Function);
	});

	it('should set a no-op completion handler when disposed', async () => {
		const module = new CompletionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();
		module.dispose();

		const handler = mockContext.connection.onCompletion.mock.calls[1][0];

		const result = await handler(
			{
				textDocument: { uri: 'foo' },
				position: Position.create(0, 0),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.connection.onCompletion).toHaveBeenCalledTimes(2);
		expect(result).toBeUndefined();
	});
});
