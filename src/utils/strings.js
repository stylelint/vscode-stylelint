'use strict';

/**
 * @param {string} str
 * @returns {string}
 */
const upperCaseFirstChar = (str) => {
	return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * @param {string} str
 * @param {number} length
 * @returns {string}
 */
const padString = (str, length) => {
	return str + ' '.repeat(length - str.length);
};

/**
 * @param {number} number
 * @param {number} length
 * @returns {string}
 */
const padNumber = (number, length) => {
	let str = String(number);

	return '0'.repeat(length - str.length) + str;
};

module.exports = {
	upperCaseFirstChar,
	padString,
	padNumber,
};
