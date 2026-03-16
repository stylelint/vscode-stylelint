/**
 * Creates a lazy-call function. The inner function will be called only the
 * first time the outer function is called. The inner function's return value
 * will be cached for the lifetime of the outer function.
 */
export function lazyCall<R>(inner: () => R): () => R {
	let cached = false;

	let cache: R;

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
 */
export function lazyCallAsync<R>(inner: () => Promise<R>): () => Promise<R> {
	let cached = false;

	let cache: R;

	return async () => {
		if (!cached) {
			cache = await inner();
			cached = true;
		}

		return cache;
	};
}
