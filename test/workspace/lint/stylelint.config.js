'use strict';

/** @typedef {import('stylelint').StylelintConfig} StylelintConfig */

// TODO: Workaround for bad typings upstream
/** @type {StylelintConfig & { overrides: StylelintConfig }} */
const config = {
	rules: {
		indentation: [4],
	},
	overrides: [
		{
			files: ['**/*.md'],
			customSyntax: '@stylelint/postcss-markdown',
		},
		{
			files: ['**/*.scss'],
			customSyntax: 'postcss-scss',
		},
	],
};

module.exports = config;
