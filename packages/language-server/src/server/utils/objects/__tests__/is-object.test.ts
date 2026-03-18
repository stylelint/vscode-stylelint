import { isObject, isEmptyObject } from '../is-object.js';
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

describe('isEmptyObject', () => {
	it('should return true for empty object', () => {
		expect(isEmptyObject({})).toBe(true);
	});

	it('should return false for object with properties', () => {
		expect(isEmptyObject({ a: 1 })).toBe(false);
		expect(isEmptyObject({ rules: {} })).toBe(false);
	});

	it('should return false for arrays', () => {
		expect(isEmptyObject([])).toBe(false);
		expect(isEmptyObject([1, 2, 3])).toBe(false);
	});

	it('should return false for null and undefined', () => {
		expect(isEmptyObject(null)).toBe(false);
		expect(isEmptyObject(undefined)).toBe(false);
	});

	it('should return false for primitives', () => {
		expect(isEmptyObject(true)).toBe(false);
		expect(isEmptyObject(0)).toBe(false);
		expect(isEmptyObject('')).toBe(false);
	});
});
