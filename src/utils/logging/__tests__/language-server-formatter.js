'use strict';

const { LEVEL, MESSAGE } = require('triple-beam');

const { LanguageServerFormatter } = require('../language-server-formatter');

// Test winston formatter

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
 * @param {{[key: string | symbol]: any}} [data]
 * @returns {winston.Logform.TransformableInfo}
 */
const createMockInfo = (message, level, data = {}) => {
	return /** @type {any} */ ({
		[MESSAGE]: message,
		[LEVEL]: level,
		message,
		level,
		...data,
	});
};

describe('languageServerFormatter', () => {
	beforeAll(() => {
		jest.useFakeTimers('modern');
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	test('should accept options', () => {
		/** @type {LanguageServerFormatterOptions} */
		const options = {
			connection: mockConnection,
			preferredKeyOrder: ['uri', 'module'],
		};

		const format = new LanguageServerFormatter(options);

		expect(format.options?.connection).toBe(mockConnection);
		expect(format.options?.preferredKeyOrder).toEqual(options.preferredKeyOrder);
	});

	test('should format a log message without data or a component tag', () => {
		const info = createMockInfo('test message', 'info');
		const format = new LanguageServerFormatter({
			connection: mockConnection,
		});

		expect(format.transform(info)).toStrictEqual({
			[MESSAGE]: 'test message',
			[LEVEL]: 'info',
			message: 'test message',
			level: 'info',
		});
	});

	test('should format a log message with data but no component tag', () => {
		const info = createMockInfo('test message', 'warn', {
			foo: 'bar',
		});
		const format = new LanguageServerFormatter({
			connection: mockConnection,
		});

		expect(format.transform(info)).toStrictEqual({
			[MESSAGE]: 'test message | foo: "bar"',
			[LEVEL]: 'warn',
			message: 'test message | foo: "bar"',
			level: 'warn',
		});
	});

	test('should format a log message with data and a component tag', () => {
		const info = createMockInfo('test message', 'error', {
			component: 'foo',
			foo: 'bar',
		});
		const format = new LanguageServerFormatter({
			connection: mockConnection,
		});

		expect(format.transform(info)).toStrictEqual({
			[MESSAGE]: '[foo] test message | foo: "bar"',
			[LEVEL]: 'error',
			message: '[foo] test message | foo: "bar"',
			level: 'error',
		});
	});

	test('should order keys in given preferred order', () => {
		const info = createMockInfo('test message', 'error', {
			component: 'foo',
			foo: 'bar',
			module: 'baz',
		});
		const format = new LanguageServerFormatter({
			connection: mockConnection,
			preferredKeyOrder: ['module', 'foo', 'bar'],
		});

		expect(format.transform(info)).toStrictEqual({
			[MESSAGE]: '[foo] test message | module: "baz" foo: "bar"',
			[LEVEL]: 'error',
			message: '[foo] test message | module: "baz" foo: "bar"',
			level: 'error',
		});
	});

	test('should prepend a timestamp and level if using a level not implemented by the remote console', () => {
		const format = new LanguageServerFormatter({
			connection: mockConnection,
		});

		jest.setSystemTime(new Date(2021, 9, 16, 12, 15, 52));

		expect(format.transform(createMockInfo('test message', 'debug'))).toStrictEqual({
			[MESSAGE]: '[Debug - 12:15:52 p.m.] test message',
			[LEVEL]: 'debug',
			message: '[Debug - 12:15:52 p.m.] test message',
			level: 'debug',
		});

		jest.setSystemTime(new Date(2022, 4, 1, 9, 13, 12));

		expect(format.transform(createMockInfo('test message', 'debug'))).toStrictEqual({
			[MESSAGE]: '[Debug - 9:13:12 a.m.] test message',
			[LEVEL]: 'debug',
			message: '[Debug - 9:13:12 a.m.] test message',
			level: 'debug',
		});
	});
});
