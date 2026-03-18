/**
 * Checks if the given value is iterable.
 */
export function isIterable(obj: unknown): obj is Iterable<unknown> {
	return (
		obj !== null &&
		obj !== undefined &&
		typeof (obj as Record<symbol, unknown>)[Symbol.iterator] === 'function'
	);
}

/**
 * Checks if the given value is an iterable object.
 */
export function isIterableObject(obj: unknown): obj is Iterable<unknown> & object {
	return isIterable(obj) && typeof obj === 'object';
}
