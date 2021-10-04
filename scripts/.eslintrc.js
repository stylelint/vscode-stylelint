'use strict';

/** @type {import('eslint').Linter.Config} */
const config = {
	rules: {
		'no-console': 'off',
		'no-process-exit': 'off',
		'node/no-unpublished-require': 'off',
	},
};

module.exports = config;
