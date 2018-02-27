'use strict';

/*!
 * array-to-sentence | ISC (c) Shinnosuke Watanabe
 * https://github.com/shinnn/array-to-sentence
*/
function arrayToSentence(arr, options) {
	if (!Array.isArray(arr)) {
		throw new TypeError('Expected an array, but got a non-array value ' + arr + '.');
	}

	options = options || {};

	function validateOption(optionName) {
		if (typeof options[optionName] !== 'string') {
			throw new TypeError(
				'Expected `' +
				optionName +
				'` option to be a string, but got a non-string value ' +
				options[optionName] +
				'.'
			);
		}
	}

	if (options.separator === undefined) {
		options.separator = ', ';
	} else {
		validateOption('separator');
	}

	if (options.lastSeparator === undefined) {
		options.lastSeparator = ' and ';
	} else {
		validateOption('lastSeparator');
	}

	if (arr.length === 0) {
		return '';
	}

	if (arr.length === 1) {
		return arr[0];
	}

	return arr.slice(0, -1).join(options.separator) + options.lastSeparator + arr[arr.length - 1];
}

module.exports = arrayToSentence;
