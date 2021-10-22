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

/**
 * @type {{
 *   default: Record<string | symbol, Function>,
 *   posix: Record<string | symbol, Function>,
 *   win32: Record<string | symbol, Function>,
 * }}
 */
const mockedFns = {
	default: {},
	posix: {},
	win32: {},
};

const pathProxy = new Proxy(path, {
	get(_, name) {
		if (name === '__mockPlatform') {
			return __mockPlatform;
		}

		if (!mockPlatform) {
			if (typeof path[name] === 'function') {
				if (mockedFns.default[name]) {
					return mockedFns.default[name];
				}

				mockedFns.default[name] = jest.fn(path[name]);

				return mockedFns.default[name];
			}

			return path[name];
		}

		if (mockPlatform === 'win32') {
			if (typeof path.win32[name] === 'function') {
				if (mockedFns.win32[name]) {
					return mockedFns.win32[name];
				}

				mockedFns.win32[name] = jest.fn(path.win32[name]);

				return mockedFns.win32[name];
			}

			return path.win32[name];
		}

		if (typeof path.posix[name] === 'function') {
			if (mockedFns.posix[name]) {
				return mockedFns.posix[name];
			}

			mockedFns.posix[name] = jest.fn(path.posix[name]);

			return mockedFns.posix[name];
		}

		return path.posix[name];
	},
});

module.exports = pathProxy;
