'use strict';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	projects: ['<rootDir>/test/lib/jest.config.js', '<rootDir>/test/workspace/jest.config.js'],
};

module.exports = config;
