'use strict';

module.exports = {
	customSyntax: '@stylelint/postcss-css-in-js',
	rules: {
		'length-zero-no-unit': true,
		'property-no-unknown': [true, { ignoreProperties: 'what' }],
	},
};
