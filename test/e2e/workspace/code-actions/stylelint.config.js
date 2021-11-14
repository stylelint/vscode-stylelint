'use strict';

/** @type {import('stylelint').Config} */
const config = {
	rules: {
		indentation: [4],
		'color-no-invalid-hex': true,
	},
	overrides: [
		{
			files: ['**/*.js'],
			customSyntax: '@stylelint/postcss-css-in-js',
		},
	],
};

module.exports = config;
