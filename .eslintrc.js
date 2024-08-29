'use strict';

const config = {
	extends: ['stylelint'],
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'script',
		project: ['./tsconfig.src.json', './tsconfig.test.json', './tsconfig.scripts.json'],
	},
	env: {
		node: true,
		es2020: true,
	},
	reportUnusedDisableDirectives: true,
	rules: {
		strict: ['error', 'safe'],
		'n/no-missing-require': [
			'error',
			{ allowModules: ['vscode'], tryExtensions: ['.js', '.json', '.ts'] },
		],
		'n/no-missing-import': [
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
			extends: [
				'plugin:@typescript-eslint/recommended',
				'plugin:@typescript-eslint/recommended-requiring-type-checking',
			],
			rules: {
				'no-shadow': 'off',
				'no-use-before-define': 'off',
				strict: ['error', 'never'],
				'n/no-unsupported-features/es-syntax': 'off',
				'@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
				'@typescript-eslint/explicit-module-boundary-types': ['error'],
				'@typescript-eslint/no-shadow': ['error'],
				'@typescript-eslint/no-use-before-define': ['error'],
				'@typescript-eslint/switch-exhaustiveness-check': ['error'],
				'@typescript-eslint/restrict-template-expressions': [
					'error',
					{
						allowNumber: true,
						allowNullish: true,
					},
				],
			},
		},
		{
			files: ['**/*.d.ts'],
			rules: {
				'@typescript-eslint/no-unused-vars': 'off',
				'n/no-unpublished-import': 'off',
			},
		},
		{
			files: ['**/__tests__/**/*', '**/__mocks__/**/*', 'test/**/*'],
			extends: ['stylelint/jest'],
			rules: {
				'n/no-unpublished-require': 'off',
				'n/no-unpublished-import': 'off',
				'@typescript-eslint/explicit-function-return-type': 'off',
				'@typescript-eslint/explicit-module-boundary-types': 'off',
				'@typescript-eslint/require-await': 'off',
				'@typescript-eslint/no-unsafe-assignment': 'off',
				'@typescript-eslint/no-unsafe-member-access': 'off',
				'@typescript-eslint/no-unsafe-argument': 'off',
				'@typescript-eslint/no-unsafe-call': 'off',
				'@typescript-eslint/no-unsafe-return': 'off',
				'@typescript-eslint/unbound-method': 'off',
				'jest/unbound-method': 'error',
			},
		},
		{
			files: ['test/e2e/__tests__/**/*'],
			rules: {
				'jest/expect-expect': 'off',
			},
		},
	],
};

module.exports = config;
