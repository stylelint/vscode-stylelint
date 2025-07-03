'use strict';

module.exports = {
	rules: {
		'color-named': 'never',
		'color-hex-length': 'long',
		'block-no-empty': true,
		'custom-property-no-missing-var-function': [
			true,
			{ severity: 'error' },
		],
		'declaration-block-no-duplicate-properties': [
			true,
			{ severity: 'warning' },
		],
		'font-family-no-missing-generic-family-keyword': true,
		'comment-empty-line-before': 'always',
		'length-zero-no-unit': true,
	},
};
