import { InvalidOptionError } from '../types.js';
import { describe, expect, test } from 'vitest';

describe('InvalidOptionError', () => {
	test('should be an instance of Error', () => {
		const error = new InvalidOptionError([{ text: 'foo' }]);

		expect(error).toBeInstanceOf(Error);
	});

	test('should have a message listing the invalid options', () => {
		const error = new InvalidOptionError([{ text: 'foo' }, { text: 'bar' }]);

		expect(error.message).toBe('foo\nbar');
	});

	test('should keep the reasons on the error', () => {
		const error = new InvalidOptionError([{ text: 'foo' }, { text: 'bar' }]);

		expect(error.reasons).toEqual(['foo', 'bar']);
	});
});
