'use strict';

/** @type {import('jest-runner-vscode').RunnerOptions} */
const config = {
	version: '1.56.2',
	launchArgs: ['--disable-extensions'],
	openInFolder: true,
	extensionDevelopmentPath: __dirname,
};

module.exports = config;
