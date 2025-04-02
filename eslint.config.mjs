import { defineConfig, globalIgnores } from 'eslint/config';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default defineConfig([
	globalIgnores(['**/build', '**/coverage', '**/dist', 'test/e2e/workspace']),
	{
		extends: compat.extends('stylelint'),

		plugins: {
			'@typescript-eslint': typescriptEslint,
		},

		linterOptions: {
			reportUnusedDisableDirectives: true,
		},

		languageOptions: {
			globals: {
				...globals.node,
			},

			parser: tsParser,
			ecmaVersion: 2020,
			sourceType: 'commonjs',

			parserOptions: {
				project: ['./tsconfig.src.json', './tsconfig.test.json', './tsconfig.scripts.json'],
			},
		},

		rules: {
			strict: ['error', 'safe'],

			'n/no-missing-require': [
				'error',
				{
					allowModules: ['vscode'],
					tryExtensions: ['.js', '.json', '.ts'],
				},
			],

			'n/no-missing-import': [
				'error',
				{
					allowModules: ['vscode'],
					tryExtensions: ['.js', '.json', '.ts'],
				},
			],

			'require-jsdoc': 'error',

			'no-warning-comments': [
				'warn',
				{
					terms: ['todo'],
					location: 'start',
				},
			],

			'sort-imports': 'off',
		},
	},
	{
		files: ['**/*.ts'],

		extends: compat.extends(
			'plugin:@typescript-eslint/recommended',
			'plugin:@typescript-eslint/recommended-requiring-type-checking',
		),

		rules: {
			'no-shadow': 'off',
			'no-use-before-define': 'off',
			strict: ['error', 'never'],
			'n/no-unsupported-features/es-syntax': 'off',

			'@typescript-eslint/explicit-function-return-type': [
				'error',
				{
					allowExpressions: true,
				},
			],

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
		extends: compat.extends('stylelint/jest'),

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
		files: ['test/e2e/**/__tests__/**/*'],

		rules: {
			'jest/expect-expect': 'off',
		},
	},
	{
		files: ['scripts/**/*'],

		rules: {
			'no-console': 'off',
			'no-process-exit': 'off',
			'n/no-unpublished-import': 'off',
		},
	},
]);
