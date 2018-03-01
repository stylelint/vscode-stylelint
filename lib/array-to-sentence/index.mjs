/*!
 * array-to-sentence | ISC (c) Shinnosuke Watanabe
 * https://github.com/shinnn/array-to-sentence
*/
var OPTION_NAMES = ['separator', 'lastSeparator'];

export default function arrayToSentence(arr, options) {
	if (!Array.isArray(arr)) {
		throw new TypeError('Expected an array, but got a non-array value ' + arr + '.');
	}

	options = Object.assign({
		separator: ', ',
		lastSeparator: ' and ',
	}, options);

	for (var i = 0; i < 2; i++) {
		if (typeof options[OPTION_NAMES[i]] !== 'string') {
			throw new TypeError(
				'Expected `' +
				OPTION_NAMES[i] +
				'` option to be a string, but got a non-string value ' +
				options[OPTION_NAMES[i]] +
				'.'
			);
		}
	}

	if (arr.length === 0) {
		return '';
	}

	if (arr.length === 1) {
		return arr[0];
	}

	return arr.slice(0, -1).join(options.separator) + options.lastSeparator + arr[arr.length - 1];
}
