'use strict';

/** @type {import('eslint').Linter.Config} */
const config = {
	rules: {
		'no-console': 'off',
		'no-process-exit': 'off',
		'n/no-unpublished-require': 'off',
		'n/no-unpublished-import': 'off',
	},
};

module.exports = config;
