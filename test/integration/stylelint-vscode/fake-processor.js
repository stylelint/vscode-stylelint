'use strict';

// Minimal Stylelint processor for testing. Extracts the content of the first
// template literal found in the source so Stylelint can lint it as plain CSS.
module.exports = function fakeProcessor() {
	return {
		/** @param {string} input */
		code(input) {
			const start = input.indexOf('`');

			if (start === -1) {
				return input;
			}

			const end = input.indexOf('`', start + 1);
			const content = end === -1 ? input.slice(start + 1) : input.slice(start + 1, end);

			return content;
		},

		/** @param {unknown} stylelintResult */
		result(stylelintResult) {
			return stylelintResult;
		},
	};
};
