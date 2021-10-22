'use strict';

const nodeLSP = jest.createMockFromModule('vscode-languageserver/node');

/** @typedef {(globalModulesPath?: string, cwd?: string, trace?: TracerFn) => any} MockResolver */

/** @type {{[package: string]: MockResolver}} */
let mockedResolutions = {};

/**
 * Mocks module resolution for a package.
 * @param {string} packageName
 * @param {MockResolver} resolver
 */
nodeLSP.Files.__mockResolution = (packageName, resolver) => {
	mockedResolutions[packageName] = resolver;
};

/**
 * Resets all mocked resolutions.
 */
nodeLSP.Files.__resetMockedResolutions = () => {
	mockedResolutions = {};
};

/** @type {typeof import('vscode-languageserver/node').Files.resolve} */
const mockResolve = async (packageName, globalPath, cwd, trace) => {
	if (mockedResolutions[packageName]) {
		const resolved = mockedResolutions[packageName](globalPath, cwd, trace);

		if (resolved) {
			return resolved;
		}
	}

	throw Error(`Failed to resolve module: ${packageName}`);
};

nodeLSP.Files.resolve = jest.fn(mockResolve);

module.exports = nodeLSP;
