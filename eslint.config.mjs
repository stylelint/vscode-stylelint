import fs from 'node:fs';

import { defineConfig, globalIgnores } from 'eslint/config';
import jsdoc from 'eslint-plugin-jsdoc';
import stylelint from 'eslint-config-stylelint';
import vitest from '@vitest/eslint-plugin';
import tsEslint from 'typescript-eslint';
import tsEslintParser from '@typescript-eslint/parser'; // eslint-disable-line n/no-extraneous-import

const nodeVersion = fs.readFileSync(new URL('.nvmrc', import.meta.url), 'utf8');

export default defineConfig([
	globalIgnores([
		'.vscode-test',
		'build',
		'coverage',
		'dist',
		'test/integration/coverage',
		'test/e2e/workspace',
		'vitest.config.unit.ts',
		'vitest.config.integration.ts',
		'vitest.workspace.ts',
		'**/*.pnp.js',
		'**/*.pnp.cjs',
		'**/__tests__/**/*.js',
		'**/__tests__/**/*.cjs',
		'**/__tests__/**/*.mjs',
		'scripts/switch-stylelint.mjs', // Contains syntax unsupported by ESLint
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
					ignoreTypeImport: true,
					allowModules: ['vscode'],
					tryExtensions: ['.js', '.json', '.ts'],
				},
			],

			'n/file-extension-in-import': ['error', 'always'],

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
		extends: [tsEslint.configs.recommendedTypeChecked],
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
			'@typescript-eslint/no-deprecated': ['error'],

			'@typescript-eslint/restrict-template-expressions': [
				'error',
				{
					allowNumber: true,
					allowNullish: true,
				},
			],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'@typescript-eslint/no-import-type-side-effects': ['error'],
		},
	},

	{
		files: ['**/__tests__/**/*', 'test/**/*'],
		languageOptions: {
			parser: tsEslintParser,
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
			'jsdoc/require-jsdoc': 'off',
		},
	},

	{
		files: ['**/__tests__/**/*', 'test/**/*'],
		ignores: ['test/e2e/**'],
		plugins: { vitest },
		rules: {
			...vitest.configs.recommended.rules,
			'vitest/no-standalone-expect': [
				'error',
				{
					additionalTestBlockFunctions: ['test', 'testOnVersion'],
				},
			],
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
