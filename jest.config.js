'use strict';

/** @type {import('jest').Config} */
const config = {
	projects: [
		'<rootDir>/test/unit/jest.config.js',
		'<rootDir>/test/integration/jest.config.js',
		'<rootDir>/test/e2e/jest.config.js',
	],
	maxWorkers: 2,
};

module.exports = config;
