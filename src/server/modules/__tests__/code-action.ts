import { TextDocument } from 'vscode-languageserver-textdocument';
import * as LSP from 'vscode-languageserver-protocol';
import { CodeActionKind as StylelintCodeActionKind } from '../../types';

import { CodeActionModule } from '../code-action';
import { CommandId, Notification } from '../../index';
import { WorkDoneProgressReporter } from 'vscode-languageserver';

const mockContext = serverMocks.getContext();
const mockLogger = serverMocks.getLogger();

describe('CodeActionModule', () => {
	beforeEach(() => {
		mockContext.__options.validate = [];
		jest.clearAllMocks();
	});

	test('should be constructable', () => {
		expect(() => new CodeActionModule({ context: mockContext.__typed() })).not.toThrow();
	});

	test('onInitialize should return results', () => {
		const module = new CodeActionModule({ context: mockContext.__typed() });

		expect(module.onInitialize()).toMatchSnapshot();
	});

	test('onDidRegisterHandlers should register a code action handler', () => {
		const module = new CodeActionModule({ context: mockContext.__typed() });

		module.onDidRegisterHandlers();

		expect(mockContext.connection.onCodeAction).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.onCodeAction).toHaveBeenCalledWith(expect.any(Function));
	});

	test('onDidRegisterHandlers should register a InitializedRequest handler', () => {
		const module = new CodeActionModule({ context: mockContext.__typed() });

		module.onDidRegisterHandlers();

		expect(mockContext.notifications.on).toHaveBeenCalledWith(
			LSP.InitializedNotification.type,
			expect.any(Function),
		);
	});

	test('should send the DidRegisterCodeActionRequestHandler notification when InitializedNotification is received', async () => {
		const module = new CodeActionModule({ context: mockContext.__typed() });

		module.onDidRegisterHandlers();

		await mockContext.notifications.on.mock.calls[0][1]?.();

		expect(mockContext.connection.sendNotification).toHaveBeenCalledWith(
			Notification.DidRegisterCodeActionRequestHandler,
		);
	});

	test('with action kind Source, should create fix-all code actions', async () => {
		mockContext.documents.get.mockReturnValue(
			TextDocument.create('foo', 'bar', 1, 'line 1\nline 2'),
		);
		mockContext.__options.validate = ['bar'];
		mockContext.getFixes.mockResolvedValue([
			LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text'),
		]);

		const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler(
			{
				context: { only: [LSP.CodeActionKind.Source], diagnostics: [] },
				textDocument: { uri: 'foo' },
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toMatchSnapshot();
		expect(mockContext.getFixes).not.toHaveBeenCalled();
	});

	test('with action kind StylelintSourceFixAll, should create fix-all code actions', async () => {
		const document = TextDocument.create('foo', 'bar', 1, 'line 1\nline 2');

		mockContext.documents.get.mockReturnValue(document);
		mockContext.__options.validate = ['bar'];
		mockContext.getFixes.mockResolvedValue([
			LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text'),
		]);

		const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler(
			{
				context: { only: [StylelintCodeActionKind.StylelintSourceFixAll], diagnostics: [] },
				textDocument: { uri: 'foo' },
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toMatchSnapshot();
		expect(mockContext.getFixes).toHaveBeenCalledWith(document);
	});

	test('with action kind SourceFixAll, should create fix-all code actions', async () => {
		const document = TextDocument.create('foo', 'bar', 1, 'line 1\nline 2');

		mockContext.documents.get.mockReturnValue(document);
		mockContext.__options.validate = ['bar'];
		mockContext.getFixes.mockResolvedValue([
			LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text'),
		]);

		const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler(
			{
				context: { only: [LSP.CodeActionKind.SourceFixAll], diagnostics: [] },
				textDocument: { uri: 'foo' },
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toMatchSnapshot();
		expect(mockContext.getFixes).toHaveBeenCalledWith(document);
	});

	test('with action kind SourceFixAll but no fixes, should not create fix-all code actions', async () => {
		const document = TextDocument.create('foo', 'bar', 1, 'line 1\nline 2');

		mockContext.documents.get.mockReturnValue(document);
		mockContext.__options.validate = ['bar'];
		mockContext.getFixes.mockResolvedValue([]);

		const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler(
			{
				context: { only: [LSP.CodeActionKind.SourceFixAll], diagnostics: [] },
				textDocument: { uri: 'foo' },
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual([]);
		expect(mockContext.getFixes).toHaveBeenCalledWith(document);
	});

	test('with no action kind, should create actions for each Stylelint diagnostic', async () => {
		mockContext.documents.get.mockReturnValue(
			TextDocument.create('foo', 'bar', 1, 'line 1\nline 2'),
		);
		mockContext.__options.validate = ['bar'];
		const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const context: LSP.CodeActionContext = {
			diagnostics: [
				{
					message: 'Message for rule 1',
					source: 'Stylelint',
					range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
					code: 'rule 1',
					severity: LSP.DiagnosticSeverity.Error,
					codeDescription: {
						href: 'https://stylelint.io/user-guide/rules/rule',
					},
				},
				{
					message: 'Message for rule 2',
					source: 'ESLint',
					range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
					code: 'rule 2',
					severity: LSP.DiagnosticSeverity.Warning,
					codeDescription: {
						href: 'https://eslint.org/docs/rules/rule',
					},
				},
				{
					message: 'Message for rule 3',
					source: 'Stylelint',
					range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
					code: 'rule 3',
					severity: LSP.DiagnosticSeverity.Warning,
				},
				{
					message: 'Message for rule 1',
					source: 'Stylelint',
					range: LSP.Range.create(LSP.Position.create(0, 1), LSP.Position.create(0, 1)),
					code: 'rule 1',
					severity: LSP.DiagnosticSeverity.Error,
					codeDescription: {
						href: 'https://stylelint.io/user-guide/rules/rule',
					},
				},
				{
					message: 'Message for rule 4',
					source: 'Stylelint',
					range: LSP.Range.create(LSP.Position.create(0, 1), LSP.Position.create(0, 1)),
					code: 404,
					severity: LSP.DiagnosticSeverity.Error,
				},
			],
		};

		const result = await handler(
			{
				context,
				textDocument: { uri: 'foo' },
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 1)),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toMatchSnapshot();
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Returning code actions', {
			actions: result,
		});
	});

	test('with unsupported action kind, should not create actions', async () => {
		mockContext.documents.get.mockReturnValue(
			TextDocument.create('foo', 'bar', 1, 'line 1\nline 2'),
		);
		mockContext.__options.validate = ['bar'];
		const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler(
			{
				context: {
					only: ['foo'],
					diagnostics: [],
				},
				textDocument: { uri: 'foo' },
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual([]);
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenCalledWith(
			'No quick fix actions requested, skipping action creation',
		);
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Returning code actions', { actions: [] });
	});

	test('if no matching document exists, should not attempt to create actions', async () => {
		mockContext.documents.get.mockReturnValue(undefined);

		const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler(
			{
				context: { only: [LSP.CodeActionKind.Source], diagnostics: [] },
				textDocument: { uri: 'foo' },
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual([]);
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Unknown document, ignoring', { uri: 'foo' });
	});

	test('if document language ID is not in options, should not attempt to create actions', async () => {
		mockContext.documents.get.mockReturnValue(
			TextDocument.create('foo', 'bar', 1, 'line 1\nline 2'),
		);
		mockContext.__options.validate = ['baz'];

		const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.connection.onCodeAction.mock.calls[0][0];

		const result = await handler(
			{
				context: { only: [LSP.CodeActionKind.Source], diagnostics: [] },
				textDocument: { uri: 'foo' },
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

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

	describe('OpenRuleDoc command', () => {
		it('should open the rule documentation URL', async () => {
			mockContext.connection.window.showDocument.mockResolvedValue({ success: true });

			const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

			module.onDidRegisterHandlers();

			const handler = mockContext.commands.on.mock.calls.find(
				([command]) => command === CommandId.OpenRuleDoc,
			)?.[1];

			const result = await handler?.(
				{
					command: CommandId.OpenRuleDoc,
					arguments: [
						{
							uri: 'https://stylelint.io/user-guide/rules/foo',
						},
					],
				},
				{} as LSP.CancellationToken,
				{} as WorkDoneProgressReporter,
			);

			expect(result).toStrictEqual({});
			expect(mockContext.connection.window.showDocument).toHaveBeenCalledWith({
				uri: 'https://stylelint.io/user-guide/rules/foo',
				external: true,
			});
			expect(mockLogger.debug).toHaveBeenLastCalledWith('Opening rule documentation', {
				uri: 'https://stylelint.io/user-guide/rules/foo',
			});
			expect(mockLogger.warn).not.toHaveBeenCalled();
		});

		it('if no URL is provided, should do nothing', async () => {
			const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

			module.onDidRegisterHandlers();

			const handler = mockContext.commands.on.mock.calls.find(
				([command]) => command === CommandId.OpenRuleDoc,
			)?.[1];

			const result = await handler?.(
				{ command: CommandId.OpenRuleDoc },
				{} as LSP.CancellationToken,
				{} as WorkDoneProgressReporter,
			);

			expect(result).toStrictEqual({});
			expect(mockContext.connection.window.showDocument).not.toHaveBeenCalled();
			expect(mockLogger.debug).toHaveBeenLastCalledWith(
				'No URL provided, ignoring command request',
			);
			expect(mockLogger.warn).not.toHaveBeenCalled();
		});

		it('if opening the URL fails, should log a warning and respond with an error', async () => {
			mockContext.connection.window.showDocument.mockResolvedValue({ success: false });

			const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

			module.onDidRegisterHandlers();

			const handler = mockContext.commands.on.mock.calls.find(
				([command]) => command === CommandId.OpenRuleDoc,
			)?.[1];

			const result = await handler?.(
				{
					command: CommandId.OpenRuleDoc,
					arguments: [
						{
							uri: 'https://stylelint.io/user-guide/rules/foo',
						},
					],
				},
				{} as LSP.CancellationToken,
				{} as WorkDoneProgressReporter,
			);

			expect(result).toStrictEqual(
				new LSP.ResponseError(LSP.ErrorCodes.InternalError, 'Failed to open rule documentation'),
			);
			expect(mockContext.connection.window.showDocument).toHaveBeenCalledWith({
				uri: 'https://stylelint.io/user-guide/rules/foo',
				external: true,
			});
			expect(mockLogger.debug).toHaveBeenLastCalledWith('Opening rule documentation', {
				uri: 'https://stylelint.io/user-guide/rules/foo',
			});
			expect(mockLogger.warn).toHaveBeenLastCalledWith('Failed to open rule documentation', {
				uri: 'https://stylelint.io/user-guide/rules/foo',
			});
		});
	});

	it('should be disposable', () => {
		const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

		expect(module).toHaveProperty('dispose');
		expect(module.dispose).toBeInstanceOf(Function);
	});

	it('should set a no-op code action handler when disposed', async () => {
		const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();
		module.dispose();

		const handler = mockContext.connection.onCodeAction.mock.calls[1][0];

		const result = await handler(
			{
				context: {
					diagnostics: [],
					only: [LSP.CodeActionKind.QuickFix],
				},
				textDocument: { uri: 'foo' },
				range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockContext.connection.onCodeAction).toHaveBeenCalledTimes(2);
		expect(result).toBeUndefined();
	});

	it('should dispose all handler registrations when disposed', () => {
		const module = new CodeActionModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();
		module.dispose();

		const disposables = [
			...mockContext.notifications.on.mock.results,
			...mockContext.commands.on.mock.results,
		];

		expect(disposables).toHaveLength(2);
		expect(disposables[0].value.dispose).toHaveBeenCalledTimes(1);
		expect(disposables[1].value.dispose).toHaveBeenCalledTimes(1);
	});
});
