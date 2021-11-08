'use strict';

/** @type {import('stylelint').Config} */
const config = {
	extends: ['./stylelint-config1', './stylelint-config2'],
	rules: {
		'block-no-empty': true,
	},
};

module.exports = config;
