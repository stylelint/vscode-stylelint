'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	rootDir: '../..',
	testMatch: ['<rootDir>/src/**/__tests__/**/*.[jt]s?(x)'],
	verbose: true,
	modulePathIgnorePatterns: ['<rootDir>/.vscode-test'],
};

module.exports = config;
