'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	testMatch: ['<rootDir>/*/test.[jt]s?(x)'],
	verbose: true,
	modulePathIgnorePatterns: ['<rootDir>/../../.vscode-test'],
};

module.exports = config;
