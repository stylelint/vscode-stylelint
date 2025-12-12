import { intersect } from '../sets.js';
import { describe, expect, test } from 'vitest';

describe('intersect', () => {
	test('should intersect two sets', () => {
		expect(intersect(new Set([1, 2, 3]), new Set([2, 3, 4]))).toEqual(new Set([2, 3]));
		expect(intersect(new Set([1, 2]), new Set([2, 3, 4]))).toEqual(new Set([2]));
		expect(intersect(new Set([1, 2, 3]), new Set([2, 3]))).toEqual(new Set([2, 3]));
	});

	test('if one set is undefined, should return the other', () => {
		expect(intersect(new Set([1, 2, 3]), undefined)).toEqual(new Set([1, 2, 3]));
		expect(intersect(undefined, new Set([1, 2, 3]))).toEqual(new Set([1, 2, 3]));
	});

	test('if both sets are undefined, should return undefined', () => {
		expect(intersect(undefined, undefined)).toBeUndefined();
	});
});
