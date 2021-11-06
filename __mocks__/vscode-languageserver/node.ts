import type { TracerFn } from '../../src/utils/packages';

const nodeLSP = jest.createMockFromModule(
	'vscode-languageserver/node',
) as tests.mocks.VSCodeLanguageServerModule.Node;

type MockResolver = (
	globalModulesPath?: string,
	cwd?: string,
	trace?: TracerFn,
) => string | undefined;

let mockedResolutions: { [packageName: string]: MockResolver } = {};

/**
 * Mocks module resolution for a package.
 */
nodeLSP.Files.__mockResolution = (packageName: string, resolver: MockResolver) => {
	mockedResolutions[packageName] = resolver;
};

/**
 * Resets all mocked resolutions.
 */
nodeLSP.Files.__resetMockedResolutions = () => {
	mockedResolutions = {};
};

const mockResolve: typeof nodeLSP.Files.resolve = async (packageName, globalPath, cwd, trace) => {
	if (mockedResolutions[packageName]) {
		const resolved = mockedResolutions[packageName](globalPath, cwd, trace);

		if (resolved) {
			return resolved;
		}
	}

	throw Error(`Failed to resolve module: ${packageName}`);
};

nodeLSP.Files.resolve = jest.fn(mockResolve);

export = nodeLSP;
