import { isObject } from './is-object';

/**
 * Copies all enumerable properties from one or two source objects to a target
 * object, recursing for nested objects. Merges arrays by concatenating them.
 * @param target The target object to assign to.
 * @param source1 The first source object from which to copy properties.
 * @param source2 The second source object from which to copy properties.
 */
export function mergeAssign<T, U, V>(target: T, source1: U, source2?: V): T & U & V {
	const targetAsUnion = target as T & U & V;

	for (const object of [source1, source2]) {
		if (!object) {
			continue;
		}

		for (const key of Object.getOwnPropertyNames(object) as (keyof typeof object)[]) {
			const value = object[key];

			if (isObject(value)) {
				if (Array.isArray(value)) {
					const existing = targetAsUnion[key];

					targetAsUnion[key] = (
						Array.isArray(existing) ? existing.concat(value) : (value as unknown)
					) as (T & U & V)[typeof key];

					continue;
				}

				if (!targetAsUnion[key]) {
					targetAsUnion[key] = {} as (T & U & V)[typeof key];
				}

				targetAsUnion[key] = mergeAssign(targetAsUnion[key], value);
			} else {
				targetAsUnion[key] = value as (T & U & V)[typeof key];
			}
		}
	}

	return targetAsUnion;
}
