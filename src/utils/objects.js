'use strict';

// ES 2020 syntax

/**
 * Copies all enumerable properties from one or two source objects to a target
 * object, recursing for nested objects.
 * @template T
 * @template U
 * @template V
 * @param {T} target The target object to assign to.
 * @param {U} source1 The first source object from which to copy properties.
 * @param {V} [source2] The second source object from which to copy properties.
 * @returns {T & U & V}
 */
function deepAssign(target, source1, source2) {
	for (const object of [source1, source2]) {
		if (!object) {
			continue;
		}

		for (const key of /** @type {(keyof typeof object)[]} */ (Object.keys(object))) {
			const value = object[key];

			if (typeof value === 'object' && value) {
				if (!(/** @type {T & U & V} */ (target)[key])) {
					/** @type {T & U & V} */ (target)[key] = /** @type {any} */ (
						Array.isArray(value) ? [] : {}
					);
				}

				/** @type {T & U & V} */ (target)[key] = deepAssign(
					/** @type {T & U & V} */ (target)[key],
					value,
				);
			} else {
				/** @type {T & U & V} */ (target)[key] = /** @type {any} */ (value);
			}
		}
	}

	return /** @type {T & U & V} */ (target);
}

module.exports = {
	deepAssign,
};
