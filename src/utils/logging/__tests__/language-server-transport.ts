import { LEVEL, MESSAGE } from 'triple-beam';
import type winston from 'winston';
import { LanguageServerTransport } from '../language-server-transport';

// Test winston transport

const mockConnection = serverMocks.getConnection();

const createMockInfo = (message: string, level: string) =>
	({
		[MESSAGE]: message,
		[LEVEL]: level,
	} as unknown as winston.Logform.TransformableInfo);

describe('LanguageServerTransport', () => {
	let transport: LanguageServerTransport;

	beforeAll(() => {
		jest.useFakeTimers();
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		transport = new LanguageServerTransport({ connection: mockConnection });
	});

	test('should call the callback after logging', () => {
		const info = createMockInfo('test', 'info');
		const callback = jest.fn();

		transport.log(info, callback);

		expect(callback).toHaveBeenCalledTimes(1);
	});

	test('should emit a "logged" event after logging', () => {
		const info = createMockInfo('test', 'info');
		const callback = jest.fn();

		transport.on('logged', callback);

		transport.log(info, () => undefined);

		jest.runAllTimers();

		expect(callback).toHaveBeenCalledTimes(1);
	});

	test("should use the remote console's error method for error-level logs", () => {
		const info = createMockInfo('test', 'error');

		transport.log(info, () => undefined);

		expect(mockConnection.console.error).toHaveBeenCalledWith('test');
	});

	test("should use the remote console's warn method for warn-level logs", () => {
		const info = createMockInfo('test', 'warn');

		transport.log(info, () => undefined);

		expect(mockConnection.console.warn).toHaveBeenCalledWith('test');
	});

	test("should use the remote console's info method for info-level logs", () => {
		const info = createMockInfo('test', 'info');

		transport.log(info, () => undefined);

		expect(mockConnection.console.info).toHaveBeenCalledWith('test');
	});

	test("should use the remote console's log method for logs with a level unimplemented by the console", () => {
		const info = createMockInfo('test', 'debug');

		transport.log(info, () => undefined);

		expect(mockConnection.console.log).toHaveBeenCalledWith('test');
	});

	test('should not emit disposed connection errors', () => {
		const info = createMockInfo('test', 'info');
		const onError = jest.fn();

		mockConnection.console.info.mockImplementationOnce(() => {
			throw new Error('Connection is disposed.');
		});

		transport.on('error', onError);
		transport.log(info, () => undefined);

		expect(mockConnection.console.info).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledTimes(0);
	});

	test('should emit errors thrown when attempting to log', () => {
		const info = createMockInfo('test', 'info');
		const onError = jest.fn();
		const error = new Error('test');

		mockConnection.console.info.mockImplementationOnce(() => {
			throw error;
		});

		transport.on('error', onError);
		transport.log(info, () => undefined);

		expect(mockConnection.console.info).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledWith(error);
	});
});
