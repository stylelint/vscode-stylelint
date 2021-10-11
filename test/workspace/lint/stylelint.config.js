'use strict';

/** @type {stylelint.Config} */
const config = {
	rules: {
		indentation: [4],
	},
	overrides: [
		// TODO: Restore once postcss-markdown is PostCSS 8 compatible
		// {
		// 	files: ['**/*.md'],
		// 	customSyntax: '/postcss-markdown',
		// },
		{
			files: ['**/*.scss'],
			customSyntax: 'postcss-scss',
		},
	],
};

module.exports = config;
