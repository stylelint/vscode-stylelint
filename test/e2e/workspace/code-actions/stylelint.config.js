'use strict';

/** @type {import('stylelint').Config} */
const config = {
	rules: {
		'color-no-invalid-hex': true,
		'value-keyword-case': 'lower',
		'color-hex-length': 'long',
	},
	overrides: [
		{
			files: ['**/*.js'],
			customSyntax: '@stylelint/postcss-css-in-js',
		},
	],
};

module.exports = config;
