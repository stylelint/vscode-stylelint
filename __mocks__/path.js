'use strict';

const path = jest.requireActual('path');

/**
 * Mock platform.
 * @type {'posix' | 'win32' | undefined}
 */
let mockPlatform = undefined;

/**
 * Sets the mock platform. A value of `undefined` will use the actual platform.
 * @param {'posix' | 'win32'} [platform]
 * @returns {void}
 */
const __mockPlatform = (platform) => {
	mockPlatform = platform;
};

const pathProxy = new Proxy(path, {
	get(_, name) {
		if (name === '__mockPlatform') {
			return __mockPlatform;
		}

		if (!mockPlatform) {
			return path[name];
		}

		if (mockPlatform === 'win32') {
			if (typeof path.win32[name] === 'function') {
				return jest.fn(path.win32[name]);
			}

			return path.win32[name];
		}

		if (typeof path.posix[name] === 'function') {
			return jest.fn(path.posix[name]);
		}

		return path.posix[name];
	},
});

module.exports = pathProxy;
