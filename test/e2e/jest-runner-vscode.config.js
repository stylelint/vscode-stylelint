'use strict';

const path = require('node:path');
const { readFileSync } = require('node:fs');

const vscodeVersion = '1.82.3';

const pkg = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
const requiredVscodeVersion = pkg.engines.vscode.match(/\d+\.\d+\.\d+/)?.[0];

if (!requiredVscodeVersion) {
	throw new Error('Cannot find a VSCode version in package.json');
}

if (vscodeVersion !== requiredVscodeVersion) {
	throw new Error(
		`The required VSCode version in package.json is '${requiredVscodeVersion}', but actually '${vscodeVersion}'`,
	);
}

/** @type {import('jest-runner-vscode').RunnerOptions} */
const config = {
	version: vscodeVersion,
	launchArgs: ['--disable-extensions'],
	openInFolder: true,
	workspaceDir: path.join(__dirname, 'workspace/workspace.code-workspace'),
	extensionDevelopmentPath: path.join(__dirname, '../..'),
	filterOutput: false,
};

module.exports = config;
