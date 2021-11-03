'use strict';

/**
 * Checks if the given value is iterable.
 * @param {any} obj
 */
function isIterable(obj) {
	return obj !== null && obj !== undefined && typeof obj[Symbol.iterator] === 'function';
}

/**
 * Checks if the given value is an iterable object.
 * @param {any} obj
 */
function isIterableObject(obj) {
	return isIterable(obj) && typeof obj === 'object';
}

module.exports = {
	isIterable,
	isIterableObject,
};
