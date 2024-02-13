'use strict';

const path = require('path');

const pkg = require('../../package.json');

const vscodeVersion = '1.86.1';
const requiredVscodeVersion = pkg.engines.vscode.match(/\d+\.\d+\.\d+/)?.[0];

if (!requiredVscodeVersion) {
	throw new Error('Cannot find a VSCode version in package.json');
}

if (vscodeVersion !== requiredVscodeVersion) {
	throw new Error(
		`The VSCode version '${requiredVscodeVersion}' is required in package.json, but actually '${vscodeVersion}'`,
	);
}

/** @type {import('jest-runner-vscode').RunnerOptions} */
const config = {
	version: vscodeVersion,
	launchArgs: ['--disable-extensions'],
	openInFolder: true,
	workspaceDir: path.join(__dirname, 'workspace/workspace.code-workspace'),
	extensionDevelopmentPath: path.join(__dirname, '../..'),
	filterOutput: true,
};

module.exports = config;
