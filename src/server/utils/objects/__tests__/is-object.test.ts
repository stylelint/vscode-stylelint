import { isObject } from '../is-object.js';
import { describe, expect, it } from 'vitest';

describe('isObject', () => {
	it('should return true if the value is an object', () => {
		expect(isObject({})).toBe(true);
		expect(isObject([])).toBe(true);
		expect(isObject(new String(''))).toBe(true);
	});

	it('should return false if the value is a primitive', () => {
		expect(isObject(undefined)).toBe(false);
		expect(isObject(null)).toBe(false);
		expect(isObject(true)).toBe(false);
		expect(isObject(0)).toBe(false);
		expect(isObject('')).toBe(false);
		expect(isObject(NaN)).toBe(false);
	});
});
