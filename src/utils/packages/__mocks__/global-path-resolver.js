'use strict';

const resolver = jest.createMockFromModule('../global-path-resolver');

/** @type {Partial<{[packageManager in PackageManager]: string | undefined}>} */
let mockedPaths = {};

/**
 * Mocks the global path for the given package manager.
 * @param {PackageManager} packageManager
 * @param {string} [globalPath]
 */
resolver.__mockPath = (packageManager, globalPath) => {
	mockedPaths[packageManager] = globalPath;
};

/**
 * Resets all mocked paths.
 */
resolver.__resetMockedResolutions = () => {
	mockedPaths = {};
};

resolver.getGlobalPathResolver = jest.fn(() => ({
	/** @param {PackageManager} packageManager */
	async resolve(packageManager) {
		return mockedPaths[packageManager];
	},
}));

module.exports = resolver;
