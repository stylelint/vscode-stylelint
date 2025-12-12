import { LEVEL, MESSAGE } from 'triple-beam';
import type winston from 'winston';
import type { Connection } from 'vscode-languageserver/node';
import { LanguageServerTransport } from '../language-server-transport.js';
import { vi, describe, test, expect, beforeEach, beforeAll, afterAll } from 'vitest';

type LanguageServerConnectionStub = {
	connection: Connection;
	console: {
		error: ReturnType<typeof vi.fn<(message: string) => void>>;
		warn: ReturnType<typeof vi.fn<(message: string) => void>>;
		info: ReturnType<typeof vi.fn<(message: string) => void>>;
		log: ReturnType<typeof vi.fn<(message: string) => void>>;
	};
};

function createLanguageServerConnectionStub(): LanguageServerConnectionStub {
	const console = {
		error: vi.fn<(message: string) => void>(),
		warn: vi.fn<(message: string) => void>(),
		info: vi.fn<(message: string) => void>(),
		log: vi.fn<(message: string) => void>(),
	};

	return {
		connection: { console } as unknown as Connection,
		console,
	};
}

const createMockInfo = (message: string, level: string) =>
	({
		[MESSAGE]: message,
		[LEVEL]: level,
	}) as unknown as winston.Logform.TransformableInfo;

describe('LanguageServerTransport', () => {
	let transport: LanguageServerTransport;
	let connection: LanguageServerConnectionStub;

	beforeAll(() => {
		vi.useFakeTimers();
	});

	afterAll(() => {
		vi.useRealTimers();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		connection = createLanguageServerConnectionStub();
		transport = new LanguageServerTransport({ connection: connection.connection });
	});

	test('should call the callback after logging', () => {
		const info = createMockInfo('test', 'info');
		const callback = vi.fn();

		transport.log(info, callback);

		expect(callback).toHaveBeenCalledTimes(1);
	});

	test('should emit a "logged" event after logging', () => {
		const info = createMockInfo('test', 'info');
		const callback = vi.fn();

		transport.on('logged', callback);

		transport.log(info, () => undefined);

		vi.runAllTimers();

		expect(callback).toHaveBeenCalledTimes(1);
	});

	test("should use the remote console's error method for error-level logs", () => {
		const info = createMockInfo('test', 'error');

		transport.log(info, () => undefined);

		expect(connection.console.error).toHaveBeenCalledWith('test');
	});

	test("should use the remote console's warn method for warn-level logs", () => {
		const info = createMockInfo('test', 'warn');

		transport.log(info, () => undefined);

		expect(connection.console.warn).toHaveBeenCalledWith('test');
	});

	test("should use the remote console's info method for info-level logs", () => {
		const info = createMockInfo('test', 'info');

		transport.log(info, () => undefined);

		expect(connection.console.info).toHaveBeenCalledWith('test');
	});

	test("should use the remote console's log method for logs with a level unimplemented by the console", () => {
		const info = createMockInfo('test', 'foo');

		transport.log(info, () => undefined);

		expect(connection.console.log).toHaveBeenCalledWith('test');
	});

	test('should not emit disposed connection errors', () => {
		const info = createMockInfo('test', 'info');
		const onError = vi.fn();

		connection.console.info.mockImplementationOnce(() => {
			throw new Error('Connection is disposed.');
		});

		transport.on('error', onError);
		transport.log(info, () => undefined);

		expect(connection.console.info).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledTimes(0);
	});

	test('should emit errors thrown when attempting to log', () => {
		const info = createMockInfo('test', 'info');
		const onError = vi.fn();
		const error = new Error('test');

		connection.console.info.mockImplementationOnce(() => {
			throw error;
		});

		transport.on('error', onError);
		transport.log(info, () => undefined);

		expect(connection.console.info).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledWith(error);
	});
});
