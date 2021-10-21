'use strict';

const { lazyCall, lazyCallAsync } = require('../lazy-call');

describe('lazyCall', () => {
	test('should return a function', () => {
		expect(typeof lazyCall(() => undefined)).toBe('function');
	});

	test('should return a function that calls the given function', () => {
		const fn = jest.fn();
		const lazyFn = lazyCall(fn);

		lazyFn();

		expect(fn).toHaveBeenCalled();
	});

	test('should return a function that returns the result of the given function', () => {
		const fn = jest.fn(() => 'foo');
		const lazyFn = lazyCall(fn);

		expect(lazyFn()).toBe('foo');
	});

	test('should only call the given function once', () => {
		const fn = jest.fn(() => 'foo');
		const lazyFn = lazyCall(fn);

		lazyFn();
		lazyFn();

		expect(fn).toHaveBeenCalledTimes(1);
	});
});

describe('lazyCallAsync', () => {
	test('should return a function', () => {
		expect(typeof lazyCallAsync(async () => undefined)).toBe('function');
	});

	test('should return a function that calls the given function', async () => {
		const fn = jest.fn();
		const lazyFn = lazyCallAsync(fn);

		await lazyFn();

		expect(fn).toHaveBeenCalled();
	});

	test('should return a function that resolves to the result of the given function', async () => {
		const fn = jest.fn(async () => 'foo');
		const lazyFn = lazyCallAsync(fn);

		expect(await lazyFn()).toBe('foo');
	});

	test('should only call the given function once', async () => {
		const fn = jest.fn(async () => 'foo');
		const lazyFn = lazyCallAsync(fn);

		await lazyFn();
		await lazyFn();

		expect(fn).toHaveBeenCalledTimes(1);
	});
});
