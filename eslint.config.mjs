import fs from 'node:fs';

import { defineConfig, globalIgnores } from 'eslint/config';
import jsdoc from 'eslint-plugin-jsdoc';
import stylelint from 'eslint-config-stylelint';
import stylelintJest from 'eslint-config-stylelint/jest';
import typescript from 'typescript-eslint';
import typescriptParser from '@typescript-eslint/parser'; // eslint-disable-line n/no-extraneous-import

const nodeVersion = fs.readFileSync(new URL('.nvmrc', import.meta.url), 'utf8');

export default defineConfig([
	globalIgnores([
		'.vscode-test',
		'build',
		'coverage',
		'dist',
		'test/e2e/workspace',
		'eslint.config.old.mjs',
	]),

	...stylelint,

	{
		plugins: { jsdoc },

		settings: {
			node: {
				version: nodeVersion,
			},
		},

		rules: {
			'no-warning-comments': [
				'warn',
				{
					terms: ['todo'],
					location: 'start',
				},
			],

			'sort-imports': 'off',

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

			'n/no-unpublished-require': 'off',
			'n/no-unpublished-import': 'off',

			'jsdoc/require-jsdoc': 'error',
		},
	},

	{
		files: ['**/*.js'],
		languageOptions: {
			sourceType: 'commonjs',
		},
		rules: {
			strict: ['error', 'safe'],
		},
	},

	{
		files: ['**/*.ts'],
		extends: [typescript.configs.recommendedTypeChecked],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
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
		files: ['**/__tests__/**/*', '**/__mocks__/**/*', 'test/**/*'],
		extends: [stylelintJest],
		languageOptions: {
			parser: typescriptParser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
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
		},
	},
]);
