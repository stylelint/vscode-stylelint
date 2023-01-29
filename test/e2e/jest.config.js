'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	testMatch: ['<rootDir>/__tests__/**/*.[jt]s?(x)'],
	transform: { '^.+\\.[jt]sx?$': '@swc/jest' },
	testPathIgnorePatterns: ['.*jest-runner-vscode.config.js'],
	verbose: true,
	modulePathIgnorePatterns: [
		'<rootDir>/../../.vscode-test',
		'<rootDir>/workspace/defaults/yarn-[^/]+/stylelint',
		'<rootDir>/workspace/defaults/local-stylelint/node_modules',
	],
	setupFilesAfterEnv: ['<rootDir>/setup.ts'],
	runner: 'vscode',
};

module.exports = config;
