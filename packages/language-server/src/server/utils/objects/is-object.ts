/**
 * Returns true if the value is a true object (i.e. not a primitive type).
 */
export function isObject(value: unknown): value is object {
	return typeof value === 'object' && value !== null;
}

/**
 * Returns true if the value is a plain object with no own enumerable properties.
 */
export function isEmptyObject(value: unknown): boolean {
	return isObject(value) && !Array.isArray(value) && Object.keys(value).length === 0;
}
