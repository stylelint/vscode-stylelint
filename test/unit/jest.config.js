'use strict';

/** @type {import('jest').Config} */
const config = {
	rootDir: '../..',
	testMatch: ['<rootDir>/src/**/__tests__/**/*.[jt]s?(x)'],
	preset: 'ts-jest',
	transform: {
		'^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
	},
	verbose: true,
	modulePathIgnorePatterns: [
		'<rootDir>/.vscode-test',
		'<rootDir>/test/e2e/workspace/defaults/yarn-[^/]+/stylelint',
		'<rootDir>/test/e2e/workspace/defaults/local-stylelint/node_modules',
	],
	setupFilesAfterEnv: ['<rootDir>/test/unit/setup.ts'],
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
