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
		'require-jsdoc': 'error',
	},
	overrides: [
		{
			files: ['**/__tests__/**/*'],
			rules: {
				'node/no-unpublished-require': 'off',
			},
		},
	],
};

module.exports = config;
