'use strict';

const { serializeError } = require('serialize-error');
const { isIterable } = require('./iterables');

/**
 * Takes an object with errors, returning a new object in which each error has
 * been replaced by a serializable object with the error's properties. Iterables
 * that aren't arrays, maps, or sets are converted to arrays.
 * @template T
 * @template {{[K in keyof T]: T[K]}} R
 * @param {T} object The object with errors.
 * @returns {R} The object with each error replaced by a serializable object.
 */
function serializeErrors(object) {
	/**
	 * @template TInner
	 * @template {{[KInner in keyof TInner]: TInner[KInner]}} RInner
	 * @param {TInner} obj The object with errors.
	 * @param {WeakMap<any, any>} visited The set of objects that have already been visited.
	 * @returns {RInner} The object with each error replaced by a serializable object.
	 */
	const serializeInner = (obj, visited) => {
		if (!obj || typeof obj !== 'object') {
			return /** @type {RInner} */ (obj);
		}

		if (visited.has(obj)) {
			return visited.get(obj);
		}

		if (obj instanceof Error) {
			const result = /** @type {RInner} */ (/** @type {unknown} */ (serializeError(obj)));

			visited.set(obj, result);

			return result;
		}

		if (obj instanceof Map) {
			const result = new Map();

			visited.set(obj, result);

			for (const [key, value] of /** @type {Map<any, any>} */ (/** @type {unknown} */ (obj))) {
				const serializedKey = serializeInner(key, visited);
				const serializedValue = serializeInner(value, visited);

				if (key && typeof key === 'object') {
					visited.set(key, serializedKey);
				}

				if (value && typeof value === 'object') {
					visited.set(value, serializedValue);
				}

				result.set(serializedKey, serializedValue);
			}

			return /** @type {RInner} */ (/** @type {unknown} */ (result));
		}

		if (obj instanceof Set) {
			const result = new Set();

			visited.set(obj, result);

			for (const value of /** @type {Set<any>} */ (/** @type {unknown} */ (obj))) {
				if (!value || typeof value !== 'object') {
					result.add(value);
					continue;
				}

				const serializedValue = serializeInner(value, visited);

				visited.set(value, serializedValue);

				result.add(serializedValue);
			}

			return /** @type {RInner} */ (/** @type {unknown} */ (result));
		}

		if (isIterable(obj)) {
			/** @type {any[]} */
			const result = [];

			visited.set(obj, result);

			for (const value of /** @type {Iterable<any>} */ (/** @type {unknown} */ (obj))) {
				result.push(serializeInner(value, visited));
			}

			return /** @type {RInner} */ (/** @type {unknown} */ (result));
		}

		visited.set(obj, '[Circular]');

		const serializedObj = /** @type {RInner} */ (
			Object.fromEntries(
				Object.entries(obj).map(([key, value]) => {
					if (!value || typeof value !== 'object') {
						return [key, value];
					}

					if (visited.has(value)) {
						return [key, visited.get(value)];
					}

					if (value instanceof Error) {
						const serialized = serializeError(value);

						visited.set(value, serialized);

						return [key, serialized];
					}

					const result = serializeInner(value, visited);

					visited.set(value, result);

					return [key, result];
				}),
			)
		);

		visited.set(obj, serializedObj);

		return serializedObj;
	};

	return serializeInner(object, new WeakMap());
}

module.exports = {
	serializeErrors,
};
