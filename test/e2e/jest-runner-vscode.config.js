'use strict';

const path = require('path');

/** @type {import('jest-runner-vscode').RunnerOptions} */
const config = {
	version: '1.56.2',
	launchArgs: ['--disable-extensions'],
	openInFolder: true,
	workspaceDir: path.join(__dirname, 'workspace/workspace.code-workspace'),
	extensionDevelopmentPath: path.join(__dirname, '../..'),
};

module.exports = config;
