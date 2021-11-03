'use strict';

const resolver = jest.createMockFromModule('../global-path-resolver');

/** @type {Partial<{[packageManager in PackageManager]: string | Error | undefined}>} */
let mockedPaths = {};

/**
 * Mocks the global path for the given package manager. If an error is provided,
 * the mock will throw the error when called with the given package manager.
 * @param {PackageManager} packageManager
 * @param {string | Error} [globalPathOrError]
 */
resolver.__mockPath = (packageManager, globalPathOrError) => {
	mockedPaths[packageManager] = globalPathOrError;
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
		const mocked = mockedPaths[packageManager];

		if (mocked instanceof Error) {
			throw mocked;
		}

		return mocked;
	},
}));

module.exports = resolver;
