'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	testMatch: ['<rootDir>/*/test.[jt]s?(x)'],
	preset: 'ts-jest',
	globals: { 'ts-jest': { tsconfig: '<rootDir>/../../tsconfig.test.json' } },
	verbose: true,
	modulePathIgnorePatterns: [
		'<rootDir>/../../.vscode-test',
		'<rootDir>/../e2e/yarn-[^/]+/stylelint',
	],
};

module.exports = config;
