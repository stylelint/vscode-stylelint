'use strict';

/** @type {import('stylelint').Config} */
const config = {
	rules: {},
	overrides: [
		{
			files: ['lint.css', 'ignored.css'],
			rules: { 'color-hex-length': 'long', },
		},
		{
			files: ['rule-doc.css'],
			plugins: [require.resolve('./test-plugin')],
			rules: {
				'color-hex-length': 'long',
				'color-no-invalid-hex': true,
				'plugin/foo-bar': true,
			},
		},
		{
			files: ['restart.css'],
			rules: { 'block-no-empty': true },
		},
	],
};

module.exports = config;
