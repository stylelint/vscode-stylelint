'use strict';

const { LEVEL, MESSAGE } = require('triple-beam');

const { LanguageServerTransport } = require('../language-server-transport');

// Test winston transport

const mockConnection = /** @type {lsp.Connection} */ (
	/** @type {any} */ ({
		console: {
			connection: /** @type {any} */ ({}),
			error: jest.fn(),
			warn: jest.fn(),
			info: jest.fn(),
			log: jest.fn(),
		},
	})
);

/**
 * @param {string} message
 * @param {string} level
 * @returns {winston.Logform.TransformableInfo}
 */
const createMockInfo = (message, level) => {
	return /** @type {any} */ ({
		[MESSAGE]: message,
		[LEVEL]: level,
	});
};

describe('LanguageServerTransport', () => {
	/** @type {LanguageServerTransport} */
	let transport;

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

		transport.log(info, () => {});

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
