'use strict';

/** @type {import('stylelint').Config} */
const config = {
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
	],
};

module.exports = config;
