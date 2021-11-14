import type LSP from 'vscode-languageserver-protocol';
import type { Connection, WorkDoneProgressReporter } from 'vscode-languageserver';
import type winston from 'winston';
import { CommandManager } from '../command-manager';

const mockConnectionBase = {
	onExecuteCommand: jest.fn(),
};

const mockConnection = mockConnectionBase as unknown as jest.Mocked<Connection>;

const mockLogger = {
	error: jest.fn(),
	debug: jest.fn(),
} as unknown as winston.Logger;

describe('CommandManager', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should be constructable', () => {
		expect(new CommandManager(mockConnection, mockLogger)).toBeDefined();
		expect(new CommandManager(mockConnection)).toBeDefined();
	});

	it('should accept handlers for a single command', () => {
		const manager = new CommandManager(mockConnection, mockLogger);

		expect(() => manager.on('test', () => undefined)).not.toThrow();
		expect(mockLogger.debug).toHaveBeenCalledWith('Registering command', {
			command: 'test',
		});
	});

	it('should accept handlers for multiple commands', () => {
		const manager = new CommandManager(mockConnection, mockLogger);

		expect(() => manager.on(['test', 'test2'], () => undefined)).not.toThrow();
		expect(mockLogger.debug).toHaveBeenCalledWith('Registering commands', {
			commands: ['test', 'test2'],
		});
	});

	it('should register a handler with the connection', () => {
		const manager = new CommandManager(mockConnection, mockLogger);

		manager.on('test', () => undefined);
		manager.register();

		expect(mockConnection.onExecuteCommand).toHaveBeenCalledWith(expect.any(Function));
		expect(mockLogger.debug).toHaveBeenCalledWith('Registering ExecuteCommandRequest handler');
		expect(mockLogger.debug).toHaveBeenCalledWith('ExecuteCommandRequest handler registered');
	});

	it('should call registered handlers with the correct parameters', async () => {
		const manager = new CommandManager(mockConnection, mockLogger);
		const handler = jest.fn().mockResolvedValue({
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
		const manager = new CommandManager(mockConnection, mockLogger);

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
		const manager = new CommandManager(mockConnection, mockLogger);
		const handler = jest.fn().mockRejectedValue(error);

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
});
