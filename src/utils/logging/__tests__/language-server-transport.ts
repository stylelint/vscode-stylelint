import { LEVEL, MESSAGE } from 'triple-beam';
import type winston from 'winston';
import type { Connection } from 'vscode-languageserver';
import { LanguageServerTransport } from '../language-server-transport';

// Test winston transport

const mockConnection = {
	console: {
		connection: {},
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		log: jest.fn(),
	},
} as unknown as Connection;

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
});
