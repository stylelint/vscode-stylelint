'use strict';

const { defineConfig } = require('@vscode/test-cli');

const pkg = require('./package.json');

const minimumVscodeVersion = pkg.engines.vscode.match(/^>=(.+)$/)?.[1];

if (!minimumVscodeVersion) throw new Error(`"engines.vscode" is unexpected: ${pkg.engines.vscode}`);

module.exports = defineConfig({
	// TODO: files: ['test/e2e/__tests__/**/*.ts'],
	files: [
		'test/e2e/__tests__/restart.ts',
		'test/e2e/__tests__/stylelint-resolution.ts',
		'test/e2e/__tests__/validate.ts',
	],
	workspaceFolder: 'test/e2e/workspace/workspace.code-workspace',
	version: minimumVscodeVersion,
	mocha: {
		timeout: 60000,
		ui: 'bdd',
		require: ['ts-node/register'],
	},
});
