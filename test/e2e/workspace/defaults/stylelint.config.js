'use strict';

/** @type {import('stylelint').Config} */
const config = {
	overrides: [
		{
			files: ['lint.css', 'ignored.css'],
			rules: { 'function-name-case': 'lower', },
		},
		{
			files: ['rule-doc.css'],
			plugins: [require.resolve('./test-plugin')],
			rules: {
				'function-name-case': 'lower',
				'color-no-invalid-hex': true,
				'plugin/foo-bar': true,
			},
		},
	],
};

module.exports = config;
