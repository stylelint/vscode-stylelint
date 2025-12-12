/**
 * Returns true if the value is a true object (i.e. not a primitive type).
 */
export function isObject(value: unknown): value is object {
	return typeof value === 'object' && value !== null;
}
