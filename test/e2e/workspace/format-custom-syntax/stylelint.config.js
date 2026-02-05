'use strict';

module.exports = {
	overrides: [
		{
			files: ['*.scss', '**/*.scss'],
			customSyntax: 'postcss-scss',
		},
	],
	rules: {
		// Stylistic rules for formatting available in Stylelint <16
		indentation: 2,
		'no-eol-whitespace': true,
	},
};
