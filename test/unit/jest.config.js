'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	rootDir: '../..',
	testMatch: ['<rootDir>/src/**/__tests__/**/*.[jt]s?(x)'],
	preset: 'ts-jest',
	globals: { 'ts-jest': { tsconfig: '<rootDir>/tsconfig.test.json' } },
	verbose: true,
	modulePathIgnorePatterns: [
		'<rootDir>/.vscode-test',
		'<rootDir>/test/e2e/defaults/workspace/yarn-[^/]+/stylelint',
		'<rootDir>/test/e2e/defaults/workspace/local-stylelint/node_modules',
	],
	collectCoverage: true,
	coverageThreshold: {
		global: {
			branches: 100,
			functions: 100,
			lines: 100,
			statements: 100,
		},
	},
	maxWorkers: 2,
};

module.exports = config;
