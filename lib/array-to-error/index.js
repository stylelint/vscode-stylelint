'use strict';

const arrayToSentence = require('../array-to-sentence');

/**
 * @param {string} item
 * @returns {item is never}
 */
const isNotString = (item) => typeof item !== 'string';

/**
 * @typedef { Error & {reasons?: string[]} } HasReasonsError
 */
/**
 * @param {string[]} arr
 * @param { new (message: string) => Error } [ErrorConstructor]
 * @returns {HasReasonsError}
 */
module.exports = function arrayToError(arr, ErrorConstructor) {
	if (!Array.isArray(arr)) {
		throw new TypeError(`${arr} is not an array. Expected an array of error messages.`);
	}

	const nonStringValues = arr.filter(isNotString);

	if (nonStringValues.length !== 0) {
		const isPlural = nonStringValues.length > 1;

		throw new TypeError(
			`${arrayToSentence(nonStringValues)} ${isPlural ? 'are' : 'is'} not ${
				isPlural ? 'strings' : 'a string'
			}. Expected every item in the array is an error message string.`,
		);
	}

	if (ErrorConstructor !== undefined) {
		if (typeof ErrorConstructor !== 'function') {
			throw new TypeError(`${ErrorConstructor} is not a function. Expected an error constructor.`);
		}
	} else {
		ErrorConstructor = Error;
	}

	/** @type {HasReasonsError} */
	const error = new ErrorConstructor(arr.join('\n'));

	error.reasons = arr;

	return error;
};
