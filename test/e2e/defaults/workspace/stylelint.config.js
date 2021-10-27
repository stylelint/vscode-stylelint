'use strict';

/** @type {stylelint.Config} */
const config = {
	overrides: [
		{
			files: ['lint.css', 'ignored.css'],
			rules: { indentation: [4] },
		},
		{
			files: ['rule-doc.css'],
			plugins: [require.resolve('./test-plugin')],
			rules: {
				indentation: [4],
				'color-no-invalid-hex': true,
				'plugin/foo-bar': true,
			},
		},
	],
};

module.exports = config;
