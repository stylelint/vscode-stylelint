'use strict';

const { defineConfig } = require('@vscode/test-cli');

const pkg = require('./package.json');

const minimumVscodeVersion = pkg.engines.vscode.match(/^>=(.+)$/)?.[1];

if (!minimumVscodeVersion) throw new Error(`"engines.vscode" is unexpected: ${pkg.engines.vscode}`);

module.exports = defineConfig([
	{
		files: ['test/e2e/__tests__/**/*.ts'],
		workspaceFolder: 'test/e2e/workspace/workspace.code-workspace',
		version: minimumVscodeVersion,
		mocha: {
			timeout: 60000,
			ui: 'bdd',
			require: ['ts-node/register'],
		},
	},
	{
		// Because PnP tests apply patches to the Node filesystem,
		// we run them in a separate process to ensure they don't interfere with other tests.
		files: ['test/e2e/pnp/__tests__/**/*.ts'],
		workspaceFolder: 'test/e2e/workspace/workspace.code-workspace',
		version: minimumVscodeVersion,
		mocha: {
			timeout: 60000,
			ui: 'bdd',
			require: ['ts-node/register'],
		},
	},
]);
