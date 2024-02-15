'use strict';

/** @type {import('jest').Config} */
const config = {
	testMatch: [
		'<rootDir>/stylelint-vscode/test.[jt]s?(x)',
		'<rootDir>/server/__tests__/**/*.[jt]s?(x)',
	],
	preset: 'ts-jest',
	transform: {
		'^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/../../tsconfig.test.json' }],
	},
	verbose: true,
	setupFilesAfterEnv: ['<rootDir>/setup.ts'],
	modulePathIgnorePatterns: [
		'<rootDir>/../../.vscode-test',
		'<rootDir>/../e2e/workspace/defaults/yarn-[^/]+/stylelint',
		'<rootDir>/../e2e/workspace/defaults/local-stylelint/node_modules',
	],
};

module.exports = config;
