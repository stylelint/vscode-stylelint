import { isObject } from './is-object';

/**
 * Copies all enumerable properties from one or two source objects to a target
 * object, recursing for nested objects. Merges arrays by concatenating them.
 * @param target The target object to assign to.
 * @param source1 The first source object from which to copy properties.
 * @param source2 The second source object from which to copy properties.
 */
export function mergeAssign<T, U, V>(target: T, source1: U, source2?: V): T & U & V {
	type UnionType = T & U & V;
	type UnionKeys = keyof T & keyof U & keyof V;
	const targetAsUnion = target as UnionType;

	for (const object of [source1, source2]) {
		if (!object) {
			continue;
		}

		for (const key of Object.getOwnPropertyNames(object) as (keyof typeof object)[]) {
			if (key === '__proto__' || key === 'constructor') {
				continue;
			}

			const value = object[key];

			if (isObject(value)) {
				if (Array.isArray(value)) {
					const existing = targetAsUnion[key as UnionKeys];

					targetAsUnion[key as UnionKeys] = (
						Array.isArray(existing) ? existing.concat(value) : (value as unknown)
					) as UnionType[UnionKeys];

					continue;
				}

				if (!targetAsUnion[key as UnionKeys]) {
					targetAsUnion[key as UnionKeys] = {} as UnionType[UnionKeys];
				}

				targetAsUnion[key as UnionKeys] = mergeAssign(targetAsUnion[key as UnionKeys], value);
			} else {
				targetAsUnion[key as UnionKeys] = value as UnionType[UnionKeys];
			}
		}
	}

	return targetAsUnion;
}
