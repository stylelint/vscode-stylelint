'use strict';

/** @type {import('eslint').Linter.Config} */
const config = {
	extends: ['stylelint', 'plugin:node/recommended', 'prettier'],
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'script',
	},
	env: {
		node: true,
		es2020: true,
	},
	rules: {
		strict: ['error', 'safe'],
		'node/no-missing-require': [
			'error',
			{ allowModules: ['vscode'], tryExtensions: ['.js', '.json', '.ts'] },
		],
		'node/no-missing-import': [
			'error',
			{ allowModules: ['vscode'], tryExtensions: ['.js', '.json', '.ts'] },
		],
		'require-jsdoc': 'error',
		'no-warning-comments': ['warn', { terms: ['todo'], location: 'start' }],
		'sort-imports': 'off',
	},
	overrides: [
		{
			files: ['**/*.ts'],
			extends: ['plugin:@typescript-eslint/recommended'],
			rules: {
				'no-shadow': 'off',
				'no-use-before-define': 'off',
				strict: ['error', 'never'],
				'node/no-unsupported-features/es-syntax': 'off',
				'@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
				'@typescript-eslint/explicit-module-boundary-types': ['error'],
				'@typescript-eslint/no-shadow': ['error'],
				'@typescript-eslint/no-use-before-define': ['error'],
			},
		},
		{
			files: ['**/*.d.ts'],
			rules: {
				'@typescript-eslint/no-unused-vars': 'off',
				'node/no-unpublished-import': 'off',
			},
		},
		{
			files: ['**/__tests__/**/*', '**/__mocks__/**/*', 'test/**/*'],
			rules: {
				'node/no-unpublished-require': 'off',
				'node/no-unpublished-import': 'off',
				'@typescript-eslint/explicit-function-return-type': 'off',
			},
		},
	],
};

module.exports = config;
