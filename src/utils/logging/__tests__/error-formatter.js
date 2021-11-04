'use strict';

const { LEVEL, MESSAGE } = require('triple-beam');

const { ErrorFormatter } = require('../error-formatter');

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

describe('ErrorFormatter', () => {
	beforeAll(() => {
		jest.useFakeTimers();
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	test('should format a log message without data', () => {
		const info = createMockInfo('test message', 'info');
		const format = new ErrorFormatter();

		expect(format.transform(info)).toStrictEqual({
			[MESSAGE]: 'test message',
			[LEVEL]: 'info',
			message: 'test message',
			level: 'info',
		});
	});

	test('should format a log message with data', () => {
		const info = createMockInfo('test message', 'warn', {
			foo: 'bar',
			error: new Error('test error'),
		});
		const format = new ErrorFormatter();

		expect(format.transform(info)).toStrictEqual({
			[MESSAGE]: 'test message',
			[LEVEL]: 'warn',
			message: 'test message',
			level: 'warn',
			foo: 'bar',
			error: {
				name: 'Error',
				message: 'test error',
				stack: expect.any(String),
			},
		});
	});
});
