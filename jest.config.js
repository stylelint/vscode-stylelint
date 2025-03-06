'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	projects: ['<rootDir>/test/unit/jest.config.js', '<rootDir>/test/integration/jest.config.js'],
	maxWorkers: 2,
};

module.exports = config;
