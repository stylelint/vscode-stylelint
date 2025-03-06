'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	testMatch: [
		'<rootDir>/stylelint-vscode/test.[jt]s?(x)',
		'<rootDir>/server/__tests__/**/*.[jt]s?(x)',
	],
	preset: 'ts-jest',
	globals: { 'ts-jest': { tsconfig: '<rootDir>/../../tsconfig.test.json' } },
	verbose: true,
	setupFilesAfterEnv: ['<rootDir>/setup.ts'],
	modulePathIgnorePatterns: [
		'<rootDir>/../../.vscode-test',
		'<rootDir>/../e2e/workspace/defaults/yarn-[^/]+/stylelint',
		'<rootDir>/../e2e/workspace/defaults/local-stylelint/node_modules',
	],

	// Prettier version 3 is not supported!
	// See https://jestjs.io/docs/configuration/#prettierpath-string
	prettierPath: null,
};

module.exports = config;
