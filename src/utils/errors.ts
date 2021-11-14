import { serializeError } from 'serialize-error';
import { isIterable } from './iterables';
import { isObject } from './objects';

/**
 * Takes an object with errors, returning a new object in which each error has
 * been replaced by a serializable object with the error's properties. Iterables
 * that aren't arrays, maps, or sets are converted to arrays.
 * @param object The object with errors.
 * @returns The object with each error replaced by a serializable object.
 */
export function serializeErrors<T, R extends { [K in keyof T]: T[K] }>(object: T): R {
	/**
	 * @param obj The object with errors.
	 * @param visited The set of objects that have already been visited.
	 * @returns The object with each error replaced by a serializable object.
	 */
	const serializeInner = <TInner, RInner extends { [KInner in keyof TInner]: TInner[KInner] }>(
		obj: TInner,
		visited: WeakMap<object, unknown>,
	): RInner => {
		if (!obj || typeof obj !== 'object') {
			return obj as RInner;
		}

		if (visited.has(obj as unknown as object)) {
			return visited.get(obj as unknown as object) as RInner;
		}

		if (obj instanceof Error) {
			const result = serializeError(obj) as unknown as RInner;

			visited.set(obj, result);

			return result;
		}

		if (obj instanceof Map) {
			const result = new Map();

			visited.set(obj, result);

			for (const [key, value] of obj) {
				const serializedKey = serializeInner(key, visited);
				const serializedValue = serializeInner(value, visited);

				if (isObject(key)) {
					visited.set(key, serializedKey);
				}

				if (isObject(value)) {
					visited.set(value, serializedValue);
				}

				result.set(serializedKey, serializedValue);
			}

			return result as unknown as RInner;
		}

		if (obj instanceof Set) {
			const result = new Set();

			visited.set(obj, result);

			for (const value of obj) {
				if (!isObject(value)) {
					result.add(value);
					continue;
				}

				const serializedValue = serializeInner(value, visited);

				visited.set(value, serializedValue);

				result.add(serializedValue);
			}

			return result as unknown as RInner;
		}

		if (isIterable(obj)) {
			const result: unknown[] = [];

			visited.set(obj as unknown as object, result);

			for (const value of obj) {
				result.push(serializeInner(value, visited));
			}

			return result as unknown as RInner;
		}

		visited.set(obj as unknown as object, '[Circular]');

		const serializedObj = Object.fromEntries(
			Object.entries(obj).map(([key, value]) => {
				if (!isObject(value)) {
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
		) as RInner;

		visited.set(obj as unknown as RInner, serializedObj);

		return serializedObj;
	};

	return serializeInner(object, new WeakMap());
}
