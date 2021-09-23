'use strict';

module.exports = {
	extends: ['stylelint', 'prettier'],
	parserOptions: {
		ecmaVersion: 2020,
	},
	rules: {
		'node/no-missing-require': [
			'error',
			{
				allowModules: ['vscode'],
			},
		],
		'node/no-unpublished-require': [
			'error',
			{
				allowModules: ['p-wait-for'],
			},
		],
		'node/no-unsupported-features/node-builtins': [
			'error',
			{
				version: '>=14.16.0',
				ignores: [],
			},
		],
	},
};
