'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	testMatch: ['<rootDir>/__tests__/**/*.[jt]s?(x)'],
	preset: 'ts-jest',
	globals: { 'ts-jest': { tsconfig: '<rootDir>/../../tsconfig.test.json' } },
	testPathIgnorePatterns: ['.*jest-runner-vscode.config.js'],
	verbose: true,
	modulePathIgnorePatterns: [
		'<rootDir>/../../.vscode-test',
		'<rootDir>/workspace/defaults/yarn-[^/]+/stylelint',
		'<rootDir>/workspace/defaults/local-stylelint/node_modules',
	],
	setupFilesAfterEnv: ['<rootDir>/setup.ts'],
	runner: 'vscode',
	maxWorkers: 1,

	// Prettier version 3 is not supported!
	// See https://jestjs.io/docs/configuration/#prettierpath-string
	prettierPath: null,
};

module.exports = config;
