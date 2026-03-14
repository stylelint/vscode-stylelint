'use strict';

/** @type {import('stylelint').Config} */
const config = {
	rules: {
		'color-hex-length': 'long',
		'value-keyword-case': 'lower',
		'color-no-invalid-hex': true,
		'font-family-no-duplicate-names': true,
		'declaration-block-no-duplicate-properties': true,
		'block-no-empty': true,
		'number-max-precision': 2,
		'selector-pseudo-class-no-unknown': true,
		'selector-pseudo-element-colon-notation': 'double',
		'selector-type-case': 'lower',
		'shorthand-property-no-redundant-values': true,
		'declaration-block-single-line-max-declarations': 1,
		'no-duplicate-selectors': true,
		'comment-no-empty': true,
		'font-family-name-quotes': 'always-where-recommended',
		'declaration-no-important': true,
		'unit-no-unknown': true,
		'property-no-unknown': true,
		'max-nesting-depth': 2,
		'selector-max-id': 0,
	},
};

module.exports = config;
