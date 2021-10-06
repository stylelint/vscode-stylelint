'use strict';

// Abbreviated example
const stylelint = /** @type {import('stylelint').StylelintPublicAPI} */ (require('stylelint'));

const ruleName = 'plugin/foo-bar';
const messages = stylelint.utils.ruleMessages(ruleName, {
	expected: 'Bar',
});

/**
 * @typedef {import('postcss').Root} PostCSSRoot
 * @typedef {import('stylelint').PostcssResult} PostCSSResult
 */

module.exports = stylelint.createPlugin(ruleName, (/** @type {any} */ primaryOption) => {
	return function (
		/** @type {PostCSSRoot} */ postcssRoot,
		/** @type {PostCSSResult} */ postcssResult,
	) {
		const validOptions = stylelint.utils.validateOptions(postcssResult, ruleName, {
			actual: primaryOption,
		});

		if (!validOptions) {
			return;
		}

		stylelint.utils.report({
			ruleName,
			result: postcssResult,
			message: messages.expected,
			node: postcssRoot,
			index: 5,
		});
	};
});

module.exports.messages = messages;
