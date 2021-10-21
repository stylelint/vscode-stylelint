'use strict';

/**
 * Runs each function, passing the result of the first function return
 * a value that is not `undefined`. Any subsequent functions are not run.
 * @template {unknown | undefined} V
 * @param {(() => V)[]} functions
 * @returns {V | undefined}
 */
function getFirstReturnValue(...functions) {
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
 * @template {unknown | undefined} V
 * @param {(() => Promise<V>)[]} functions
 * @returns {Promise<V | undefined>}
 */
async function getFirstResolvedValue(...functions) {
	for (const func of functions) {
		const result = await func();

		if (result !== undefined) {
			return result;
		}
	}

	return undefined;
}

module.exports = {
	getFirstReturnValue,
	getFirstResolvedValue,
};
