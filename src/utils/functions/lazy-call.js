'use strict';

/**
 * Creates a lazy-call function. The inner function will be called only the
 * first time the outer function is called. The inner function's return value
 * will be cached for the lifetime of the outer function.
 * @template {() => any} T
 * @param {T} inner
 * @returns {() => ReturnType<T>}
 */
function lazyCall(inner) {
	let cached = false;

	/** @type {ReturnType<T>} */
	let cache;

	return () => {
		if (!cached) {
			cache = inner();
			cached = true;
		}

		return cache;
	};
}

/**
 * Creates an async lazy-call function. The inner function will be called only
 * the first time the outer function is called. The inner function's resolved
 * value will be cached for the lifetime of the outer function.
 * @template {() => Promise<any>} T
 * @param {T} inner
 * @returns {() => Promise<ReturnType<T> extends PromiseLike<infer U> ? U : T>}
 */
function lazyCallAsync(inner) {
	let cached = false;

	/** @type {ReturnType<T> extends PromiseLike<infer U> ? U : T} */
	let cache;

	return async () => {
		if (!cached) {
			cache = await inner();
			cached = true;
		}

		return cache;
	};
}

module.exports = {
	lazyCall,
	lazyCallAsync,
};
