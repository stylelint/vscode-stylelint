'use strict';

/** @type {import('stylelint').Config} */
const config = {
	extends: ['./stylelint-config1.js', './stylelint-config2.js'],
	rules: {
		'block-no-empty': true,
	},
};

module.exports = config;
