/**
 * Runs each function, passing the result of the first function return
 * a value that is not `undefined`. Any subsequent functions are not run.
 */
export function getFirstReturnValue<V extends unknown | undefined>(
	...functions: (() => V)[]
): V | undefined {
	for (const func of functions) {
		const result = func();

		if (result !== undefined) {
			return result;
		}
	}

	return undefined;
}

/**
 * Runs each async function, passing the resolved value of the first function
 * that resolves to a value that is not `undefined`. Any subsequent functions
 * are not run.
 */
export async function getFirstResolvedValue<V extends unknown | undefined>(
	...functions: (() => Promise<V>)[]
): Promise<V | undefined> {
	for (const func of functions) {
		const result = await func();

		if (result !== undefined) {
			return result;
		}
	}

	return undefined;
}
