'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	testMatch: ['<rootDir>/*/index.[jt]s?(x)', '<rootDir>/defaults/*.[jt]s?(x)'],
	testPathIgnorePatterns: ['.*jest-runner-vscode.config.js'],
	verbose: true,
	modulePathIgnorePatterns: ['<rootDir>/../../.vscode-test', '<rootDir>/yarn-[^/]+/stylelint'],
	setupFilesAfterEnv: ['<rootDir>/setup.js'],
	runner: 'vscode',
};

module.exports = config;
