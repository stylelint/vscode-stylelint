'use strict';

/** @type {import('eslint').Linter.Config} */
const config = {
	extends: ['stylelint', 'plugin:node/recommended', 'prettier'],
	parser: '@babel/eslint-parser',
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'script',
		requireConfigFile: false,
		babelOptions: {
			presets: [['@babel/preset-env', { targets: { node: '4' } }]],
		},
	},
	env: {
		node: true,
		es2020: true,
	},
	rules: {
		strict: ['error', 'safe'],
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
