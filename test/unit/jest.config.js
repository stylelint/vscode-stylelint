'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	rootDir: '../..',
	testMatch: ['<rootDir>/src/**/__tests__/**/*.[jt]s?(x)'],
	transform: {
		['^.+.[jt]s$']: ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
	},
	modulePathIgnorePatterns: [
		'<rootDir>/.vscode-test',
		'<rootDir>/test/e2e/workspace/defaults/yarn-[^/]+/stylelint',
		'<rootDir>/test/e2e/workspace/defaults/local-stylelint/node_modules',
	],
	setupFilesAfterEnv: ['<rootDir>/test/unit/setup.ts'],
	coverageThreshold: {
		global: {
			branches: 99,
			functions: 100,
			lines: 100,
			statements: 100,
		},
	},
	maxWorkers: 2,

	// Prettier version 3 is not supported!
	// See https://jestjs.io/docs/configuration/#prettierpath-string
	prettierPath: null,
};

module.exports = config;
