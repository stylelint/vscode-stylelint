'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	projects: [
		'<rootDir>/test/unit/jest.config.js',
		'<rootDir>/test/integration/jest.config.js',
		'<rootDir>/test/e2e/jest.config.js',
	],
};

module.exports = config;
