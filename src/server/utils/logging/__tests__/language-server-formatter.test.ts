import { LEVEL, MESSAGE } from 'triple-beam';
import type winston from 'winston';
import type { Connection } from 'vscode-languageserver';
import {
	LanguageServerFormatter,
	LanguageServerFormatterOptions,
} from '../language-server-formatter.js';
import { vi, describe, test, expect, beforeAll, afterAll } from 'vitest';

const mockConnection = {
	console: {
		connection: {},
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		log: vi.fn(),
	},
} as unknown as Connection;

const createMockInfo = (
	message: string,
	level: string,
	data: { [key: string | symbol]: unknown } = {},
): winston.Logform.TransformableInfo => ({
	[MESSAGE]: message,
	[LEVEL]: level,
	message,
	level,
	...data,
});

describe('languageServerFormatter', () => {
	beforeAll(() => {
		vi.useFakeTimers();
	});

	afterAll(() => {
		vi.useRealTimers();
	});

	test('should accept options', () => {
		const options: LanguageServerFormatterOptions = {
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

		vi.setSystemTime(new Date(2021, 9, 16, 12, 15, 52));

		expect(format.transform(createMockInfo('test message', 'debug'))).toStrictEqual({
			[MESSAGE]: '[Debug - 12:15:52 p.m.] test message',
			[LEVEL]: 'debug',
			message: '[Debug - 12:15:52 p.m.] test message',
			level: 'debug',
		});

		vi.setSystemTime(new Date(2022, 4, 1, 9, 13, 12));

		expect(format.transform(createMockInfo('test message', 'debug'))).toStrictEqual({
			[MESSAGE]: '[Debug - 9:13:12 a.m.] test message',
			[LEVEL]: 'debug',
			message: '[Debug - 9:13:12 a.m.] test message',
			level: 'debug',
		});
	});
});
