import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, TextEdit } from 'vscode-languageserver-types';
import type LSP from 'vscode-languageserver-protocol';
import { CommandId } from '../../types';

import { AutoFixModule } from '../auto-fix';
import { WorkDoneProgressReporter } from 'vscode-languageserver';

const mockContext = serverMocks.getContext();
const mockLogger = serverMocks.getLogger();

describe('AutoFixModule', () => {
	beforeEach(() => {
		mockContext.__options.validate = [];
		jest.clearAllMocks();
	});

	test('should be constructable', () => {
		expect(() => new AutoFixModule({ context: mockContext.__typed() })).not.toThrow();
	});

	test('onInitialize should return results', () => {
		const module = new AutoFixModule({ context: mockContext.__typed() });

		expect(module.onInitialize()).toMatchSnapshot();
	});

	test('onDidRegisterHandlers should register an auto-fix command handler', () => {
		const module = new AutoFixModule({ context: mockContext.__typed() });

		module.onDidRegisterHandlers();

		expect(mockContext.commands.on).toHaveBeenCalledTimes(1);
		expect(mockContext.commands.on).toHaveBeenCalledWith(
			CommandId.ApplyAutoFix,
			expect.any(Function),
		);
	});

	test('should auto-fix documents', async () => {
		const document = TextDocument.create('foo', 'bar', 1, 'a {}');

		mockContext.documents.get.mockReturnValue(document);
		mockContext.__options.validate = ['bar'];
		mockContext.getFixes.mockResolvedValue([TextEdit.insert(Position.create(0, 0), 'text')]);
		mockContext.connection.workspace.applyEdit.mockResolvedValue({ applied: true });

		const module = new AutoFixModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.commands.on.mock.calls.find(
			([command]) => command === CommandId.ApplyAutoFix,
		)?.[1];

		const result = await handler?.(
			{
				command: CommandId.ApplyAutoFix,
				arguments: [{ uri: 'foo', version: 1 }],
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual({});
		expect(mockContext.getFixes).toHaveBeenCalledWith(document);
		expect(mockContext.connection.workspace.applyEdit.mock.calls[0]).toMatchSnapshot();
	});

	test('with incorrect command, should not attempt to auto-fix', async () => {
		const module = new AutoFixModule({ context: mockContext.__typed() });

		module.onDidRegisterHandlers();

		const handler = mockContext.commands.on.mock.calls.find(
			([command]) => command === CommandId.ApplyAutoFix,
		)?.[1];

		const result = await handler?.(
			{ command: 'foo' },
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual({});
		expect(mockContext.getFixes).not.toHaveBeenCalled();
	});

	test('with no arguments, should not attempt to auto-fix', async () => {
		const module = new AutoFixModule({ context: mockContext.__typed() });

		module.onDidRegisterHandlers();

		const handler = mockContext.commands.on.mock.calls.find(
			([command]) => command === CommandId.ApplyAutoFix,
		)?.[1];

		const result = await handler?.(
			{ command: CommandId.ApplyAutoFix },
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual({});
		expect(mockContext.getFixes).not.toHaveBeenCalled();
	});

	test('if no matching document exists, should not attempt to auto-fix', async () => {
		mockContext.documents.get.mockReturnValue(undefined);

		const module = new AutoFixModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.commands.on.mock.calls.find(
			([command]) => command === CommandId.ApplyAutoFix,
		)?.[1];

		const result = await handler?.(
			{
				command: CommandId.ApplyAutoFix,
				arguments: [{ uri: 'foo' }],
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual({});
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Unknown document, ignoring', { uri: 'foo' });
	});

	test('if document language ID is not in options, should not attempt to auto-fix', async () => {
		mockContext.documents.get.mockReturnValue(TextDocument.create('foo', 'bar', 1, 'a {}'));
		mockContext.__options.validate = ['baz'];

		const module = new AutoFixModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.commands.on.mock.calls.find(
			([command]) => command === CommandId.ApplyAutoFix,
		)?.[1];

		const result = await handler?.(
			{
				command: CommandId.ApplyAutoFix,
				arguments: [{ uri: 'foo' }],
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual({});
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Document should not be auto-fixed, ignoring',
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

		const module = new AutoFixModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.commands.on.mock.calls.find(
			([command]) => command === CommandId.ApplyAutoFix,
		)?.[1];

		const handlerParams = {
			command: CommandId.ApplyAutoFix,
			arguments: [{ uri: 'foo' }],
		};

		const result = await handler?.(
			handlerParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual({});
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Registering onExecuteCommand handler');
	});

	test('if the document has been modified, should not attempt to auto-fix', async () => {
		mockContext.documents.get.mockReturnValue(TextDocument.create('foo', 'bar', 2, 'a {}'));
		mockContext.__options.validate = ['bar'];

		const module = new AutoFixModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.commands.on.mock.calls.find(
			([command]) => command === CommandId.ApplyAutoFix,
		)?.[1];

		const result = await handler?.(
			{
				command: CommandId.ApplyAutoFix,
				arguments: [{ uri: 'foo', version: 1 }],
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual({});
		expect(mockContext.getFixes).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Document has been modified, ignoring', {
			uri: 'foo',
		});
	});

	test('if fixes fail to apply, should log the response', async () => {
		const response = { applied: false, failureReason: 'foo' };

		mockContext.documents.get.mockReturnValue(TextDocument.create('foo', 'bar', 1, 'a {}'));
		mockContext.__options.validate = ['bar'];
		mockContext.getFixes.mockResolvedValue([TextEdit.insert(Position.create(0, 0), 'text')]);
		mockContext.connection.workspace.applyEdit.mockResolvedValue(response);

		const module = new AutoFixModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.commands.on.mock.calls.find(
			([command]) => command === CommandId.ApplyAutoFix,
		)?.[1];

		const result = await handler?.(
			{
				command: CommandId.ApplyAutoFix,
				arguments: [{ uri: 'foo', version: 1 }],
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual({});
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Failed to apply fixes', {
			uri: 'foo',
			response,
		});
	});

	test('if an error occurs while applying fixes, should log it', async () => {
		const error = new Error('foo');

		mockContext.documents.get.mockReturnValue(TextDocument.create('foo', 'bar', 1, 'a {}'));
		mockContext.__options.validate = ['bar'];
		mockContext.getFixes.mockResolvedValue([TextEdit.insert(Position.create(0, 0), 'text')]);
		mockContext.connection.workspace.applyEdit.mockRejectedValue(error);

		const module = new AutoFixModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();

		const handler = mockContext.commands.on.mock.calls.find(
			([command]) => command === CommandId.ApplyAutoFix,
		)?.[1];

		const result = await handler?.(
			{
				command: CommandId.ApplyAutoFix,
				arguments: [{ uri: 'foo', version: 1 }],
			},
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toStrictEqual({});
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Failed to apply fixes', {
			uri: 'foo',
			error,
		});
	});

	it('should be disposable', () => {
		const module = new AutoFixModule({ context: mockContext.__typed(), logger: mockLogger });

		expect(module).toHaveProperty('dispose');
		expect(module.dispose).toBeInstanceOf(Function);
	});

	it('should dispose all handler registrations when disposed', () => {
		const module = new AutoFixModule({ context: mockContext.__typed(), logger: mockLogger });

		module.onDidRegisterHandlers();
		module.dispose();

		const disposable = mockContext.commands.on.mock.results[0].value;

		expect(disposable.dispose).toHaveBeenCalledTimes(1);
	});
});
