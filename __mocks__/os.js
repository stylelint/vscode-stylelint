'use strict';

const os = jest.requireActual('os');

/**
 * Mock platform.
 * @type {NodeJS.Platform}
 */
let mockPlatform = 'linux';

/**
 * Sets the mock platform.
 * @param {NodeJS.Platform} platform
 * @returns {void}
 */
os.__mockPlatform = (platform) => {
	mockPlatform = platform;
};

os.platform = () => mockPlatform;

module.exports = os;
