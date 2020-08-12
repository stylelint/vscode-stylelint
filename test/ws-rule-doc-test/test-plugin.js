'use strict';

// Abbreviated example
const stylelint = require('stylelint');

const ruleName = 'plugin/foo-bar';
const messages = stylelint.utils.ruleMessages(ruleName, {
	expected: 'Bar',
});

module.exports = stylelint.createPlugin(ruleName, function (primaryOption) {
	return function (postcssRoot, postcssResult) {
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

module.exports.ruleName = ruleName;
module.exports.messages = messages;
