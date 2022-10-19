'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	testMatch: ['<rootDir>/*/test.[jt]s?(x)'],
	transform: { '^.+\\.[jt]sx?$': '@swc/jest' },
	verbose: true,
	modulePathIgnorePatterns: [
		'<rootDir>/../../.vscode-test',
		'<rootDir>/../e2e/workspace/defaults/yarn-[^/]+/stylelint',
		'<rootDir>/../e2e/workspace/defaults/local-stylelint/node_modules',
	],
};

module.exports = config;
