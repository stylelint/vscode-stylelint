'use strict';

/** @type {import('stylelint').Config} */
module.exports = {
	customSyntax: require.resolve('postcss-html'),
	rules: {
		'color-no-hex': true,
	},
};
