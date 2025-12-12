import { beforeEach, describe, expect, it, Mocked, vi } from 'vitest';
import type { Connection, WorkDoneProgressReporter } from 'vscode-languageserver';
import type LSP from 'vscode-languageserver-protocol';
import { CommandService } from '../command.service.js';
import type { LoggingService } from '../logging.service.js';
import { createTestLogger } from '../../../../../test/helpers/test-logger.js';

const mockConnectionBase = {
	onExecuteCommand: vi.fn(),
};

const mockConnection = mockConnectionBase as unknown as Mocked<Connection>;

const mockLogger = createTestLogger();

const mockLoggingService: LoggingService = {
	createLogger: vi.fn(() => mockLogger),
};

describe('CommandManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should be constructable', () => {
		expect(new CommandService(mockConnection, mockLoggingService)).toBeDefined();
	});

	it('should accept handlers for a single command', () => {
		const manager = new CommandService(mockConnection, mockLoggingService);

		expect(() => manager.on('test', () => undefined)).not.toThrow();
		expect(mockLogger.debug).toHaveBeenCalledWith('Registering command', {
			command: 'test',
		});
	});

	it('should accept handlers for multiple commands', () => {
		const manager = new CommandService(mockConnection, mockLoggingService);

		expect(() => manager.on(['test', 'test2'], () => undefined)).not.toThrow();
		expect(mockLogger.debug).toHaveBeenCalledWith('Registering commands', {
			commands: ['test', 'test2'],
		});
	});

	it('should register a handler with the connection', () => {
		const manager = new CommandService(mockConnection, mockLoggingService);

		manager.on('test', () => undefined);
		manager.register();

		expect(mockConnection.onExecuteCommand).toHaveBeenCalledWith(expect.any(Function));
		expect(mockLogger.debug).toHaveBeenCalledWith('Registering ExecuteCommandRequest handler');
		expect(mockLogger.debug).toHaveBeenCalledWith('ExecuteCommandRequest handler registered');
	});

	it('should call registered handlers with the correct parameters', async () => {
		const manager = new CommandService(mockConnection, mockLoggingService);
		const handler = vi.fn().mockResolvedValue({
			result: 'test',
		});

		manager.on('test', handler);
		manager.register();

		const executeCommand = mockConnection.onExecuteCommand.mock.calls[0][0];
		const result = await executeCommand(
			{
				command: 'test',
				arguments: [1, 2, 3],
			},
			{
				isCancellationRequested: false,
			} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(handler).toHaveBeenCalledWith(
			{
				command: 'test',
				arguments: [1, 2, 3],
			},
			{
				isCancellationRequested: false,
			},
			{},
		);
		expect(result).toStrictEqual({ result: 'test' });
		expect(mockLogger.debug).toHaveBeenCalledWith('Received ExecuteCommandRequest', {
			command: 'test',
			arguments: [1, 2, 3],
		});
		expect(mockLogger.debug).toHaveBeenCalledWith('Executing command', {
			command: 'test',
		});
		expect(mockLogger.debug).toHaveBeenCalledWith('Sending command response', {
			command: 'test',
			response: { result: 'test' },
		});
	});

	it('should log if no handler is registered for a command', async () => {
		const manager = new CommandService(mockConnection, mockLoggingService);

		manager.on('different', () => undefined);
		manager.register();

		const executeCommand = mockConnection.onExecuteCommand.mock.calls[0][0];

		await executeCommand(
			{
				command: 'test',
				arguments: [1, 2, 3],
			},
			{
				isCancellationRequested: false,
			} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockLogger.debug).toHaveBeenCalledWith('No handler registered for command', {
			command: 'test',
		});
	});

	it('should log and respond with an error if a handler throws', async () => {
		const error = new Error('test');
		const manager = new CommandService(mockConnection, mockLoggingService);
		const handler = vi.fn().mockRejectedValue(error);

		manager.on('test', handler);
		manager.register();

		const executeCommand = mockConnection.onExecuteCommand.mock.calls[0][0];
		const result = await executeCommand(
			{
				command: 'test',
				arguments: [1, 2, 3],
			},
			{
				isCancellationRequested: false,
			} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(handler).toHaveBeenCalledWith(
			{
				command: 'test',
				arguments: [1, 2, 3],
			},
			{
				isCancellationRequested: false,
			},
			{},
		);
		expect(result).toMatchInlineSnapshot(`[Error: Error executing command test]`);
		expect(mockLogger.error).toHaveBeenCalledWith('Error executing command', {
			command: 'test',
			error,
		});
	});

	it('should return disposables when registering commands', () => {
		const manager = new CommandService(mockConnection, mockLoggingService);
		const disposable = manager.on('test', () => undefined);

		expect(disposable).toHaveProperty('dispose');
		expect(disposable.dispose).toBeInstanceOf(Function);
	});

	it("should deregister the command handler when disposing a command's disposable", async () => {
		const manager = new CommandService(mockConnection, mockLoggingService);
		const disposable = manager.on('test', () => undefined);

		manager.register();
		disposable.dispose();

		const executeCommand = mockConnection.onExecuteCommand.mock.calls[0][0];

		await executeCommand(
			{
				command: 'test',
				arguments: [1, 2, 3],
			},
			{
				isCancellationRequested: false,
			} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockLogger.debug).toHaveBeenCalledWith('No handler registered for command', {
			command: 'test',
		});
	});
	it("should deregister the command handler for all command names when disposing a command's disposable", async () => {
		const manager = new CommandService(mockConnection, mockLoggingService);
		const disposable = manager.on(['test', 'other'], () => undefined);

		manager.register();
		disposable.dispose();

		const executeCommand = mockConnection.onExecuteCommand.mock.calls[0][0];

		await executeCommand(
			{
				command: 'test',
				arguments: [1, 2, 3],
			},
			{
				isCancellationRequested: false,
			} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		await executeCommand(
			{
				command: 'other',
				arguments: [1, 2, 3],
			},
			{
				isCancellationRequested: false,
			} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockLogger.debug).toHaveBeenCalledWith('No handler registered for command', {
			command: 'test',
		});
	});

	it('should be disposable', () => {
		const manager = new CommandService(mockConnection, mockLoggingService);

		expect(manager).toHaveProperty('dispose');
		expect(manager.dispose).toBeInstanceOf(Function);
	});

	it('should deregister all registered command handlers when disposing', () => {
		const manager = new CommandService(mockConnection, mockLoggingService);

		manager.on('test1', () => undefined);
		manager.on('test2', () => undefined);
		manager.register();
		manager.dispose();

		const executeCommand =
			mockConnection.onExecuteCommand.mock.calls[
				mockConnection.onExecuteCommand.mock.calls.length - 1
			][0];

		executeCommand(
			{
				command: 'test1',
				arguments: [1, 2, 3],
			},
			{
				isCancellationRequested: false,
			} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		executeCommand(
			{
				command: 'test2',
				arguments: [1, 2, 3],
			},
			{
				isCancellationRequested: false,
			} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockLogger.debug).not.toHaveBeenCalledWith('No handler registered for command', {
			command: 'test1',
		});
		expect(mockLogger.debug).not.toHaveBeenCalledWith('No handler registered for command', {
			command: 'test2',
		});
	});
});
