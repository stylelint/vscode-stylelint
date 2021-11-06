import { isIterable, isIterableObject } from '../iterables';

describe('isIterable', () => {
	it('should return true for an array', () => {
		expect(isIterable([])).toBe(true);
	});

	it('should return true for a Set', () => {
		expect(isIterable(new Set())).toBe(true);
	});

	it('should return true for a Map', () => {
		expect(isIterable(new Map())).toBe(true);
	});

	it('should return true for a generator', () => {
		/** Mock Iterable */
		function* generator() {
			yield 1;
		}

		expect(isIterable(generator())).toBe(true);
	});

	it('should return true for a string', () => {
		expect(isIterable('')).toBe(true);
	});

	it('should return false for a number', () => {
		expect(isIterable(0)).toBe(false);
	});

	it('should return false for a boolean', () => {
		expect(isIterable(true)).toBe(false);
	});

	it('should return false for an object', () => {
		expect(isIterable({})).toBe(false);
	});

	it('should return false for a function', () => {
		expect(isIterable(() => undefined)).toBe(false);
	});

	it('should return false for null', () => {
		expect(isIterable(null)).toBe(false);
	});

	it('should return false for undefined', () => {
		expect(isIterable(undefined)).toBe(false);
	});
});

describe('isIterableObject', () => {
	it('should return true for an array', () => {
		expect(isIterableObject([])).toBe(true);
	});

	it('should return true for a Set', () => {
		expect(isIterableObject(new Set())).toBe(true);
	});

	it('should return true for a Map', () => {
		expect(isIterableObject(new Map())).toBe(true);
	});

	it('should return true for a generator', () => {
		/** Mock Iterable */
		function* generator() {
			yield 1;
		}

		expect(isIterableObject(generator())).toBe(true);
	});

	it('should return false for a string', () => {
		expect(isIterableObject('')).toBe(false);
	});

	it('should return false for a number', () => {
		expect(isIterableObject(0)).toBe(false);
	});

	it('should return false for a boolean', () => {
		expect(isIterableObject(true)).toBe(false);
	});

	it('should return false for an object', () => {
		expect(isIterableObject({})).toBe(false);
	});

	it('should return false for a function', () => {
		expect(isIterableObject(() => undefined)).toBe(false);
	});

	it('should return false for null', () => {
		expect(isIterableObject(null)).toBe(false);
	});

	it('should return false for undefined', () => {
		expect(isIterableObject(undefined)).toBe(false);
	});
});
