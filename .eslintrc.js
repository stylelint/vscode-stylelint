'use strict';

/** @type {import('eslint').Linter.Config} */
const config = {
	extends: ['stylelint', 'plugin:node/recommended', 'prettier'],
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'script',
	},
	env: {
		node: true,
		es2020: true,
	},
	rules: {
		'node/no-missing-require': ['error', { allowModules: ['vscode'] }],
	},
};

module.exports = config;
