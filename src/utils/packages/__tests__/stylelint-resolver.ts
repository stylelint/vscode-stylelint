jest.mock('vscode-languageserver/node');
jest.mock('../global-path-resolver');
jest.mock('../find-package-root');
jest.mock('path');
jest.mock('fs/promises', () => jest.createMockFromModule('fs/promises'));
jest.mock('module');

import path from 'path';
import fs from 'fs/promises';
import module from 'module';
import type winston from 'winston';
import { Connection, Files } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { GlobalPathResolver } from '../global-path-resolver';
import { findPackageRoot } from '../find-package-root';
import { StylelintResolver } from '../stylelint-resolver';
import type { Stats } from 'fs';
import type { PackageManager } from '../index';

const mockedPath = path as tests.mocks.PathModule;
const mockedFS = fs as jest.Mocked<typeof fs>;
const mockedModule = module as jest.Mocked<typeof module>;
const mockedFiles = Files as tests.mocks.VSCodeLanguageServerModule.Node['Files'];
const mockedGlobalPathResolver = GlobalPathResolver as jest.Mock<GlobalPathResolver>;
const mockedFindPackageRoot = findPackageRoot as jest.MockedFunction<typeof findPackageRoot>;

let mockCWD: string | undefined = mockedPath.join('/fake', 'cwd');
let mockPnPVersion: string | undefined = undefined;

jest.mock('../../documents', () => ({
	getWorkspaceFolder: jest.fn(async () => mockCWD),
}));

jest.mock('process', () => ({
	versions: {
		get pnp() {
			return mockPnPVersion;
		},
	},
}));

const createMockConnection = () =>
	({
		console: { error: jest.fn() },
		window: { showErrorMessage: jest.fn() },
		tracer: { log: jest.fn() },
	}) as unknown as Connection;

const createMockLogger = () =>
	({
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	}) as unknown as winston.Logger;

const createMockTextDocument = (nonFileURI = false) =>
	({
		uri: nonFileURI ? 'scheme:///fake/cwd/document.css' : 'file:///fake/cwd/document.css',
	}) as TextDocument;

const goodStylelintPath = mockedPath.join(__dirname, 'stylelint.js');
const badStylelintPath = mockedPath.join(__dirname, 'bad-stylelint.js');

const pnpPath = mockedPath.join(__dirname, '.pnp.cjs');
const pnpJSPath = mockedPath.join(__dirname, '.pnp.js');

const mockGlobalPaths: { [packageManager in PackageManager]: string } = {
	yarn: mockedPath.join('/fake', 'yarn'),
	npm: mockedPath.join('/fake', 'npm'),
	pnpm: mockedPath.join('/fake', 'pnpm'),
};

jest.doMock(path.join(__dirname, 'stylelint.js'), () => ({ lint: jest.fn(() => 'good') }), {
	virtual: true,
});
jest.doMock(path.join(__dirname, 'bad-stylelint.js'), () => ({}), {
	virtual: true,
});
jest.doMock(path.join(__dirname, '.pnp.cjs'), () => ({ setup: jest.fn() }), {
	virtual: true,
});
jest.doMock(path.join(__dirname, '.pnp.js'), () => ({ setup: jest.fn() }), {
	virtual: true,
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockedPnP = require(pnpPath) as jest.Mocked<{ setup: () => void }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockedJSPnP = require(pnpJSPath) as jest.Mocked<{ setup: () => void }>;

const mockGlobalFileResolution = (packageManager: PackageManager, stylelintPath: string) => {
	mockedFiles.__mockResolution('stylelint', (globalPath, cwd, trace) => {
		if (trace) trace('Resolving globally');

		return cwd === mockCWD && globalPath === mockGlobalPaths[packageManager]
			? stylelintPath
			: undefined;
	});
};

const mockLocalFileResolution = (stylelintPath: string) => {
	mockedFiles.__mockResolution('stylelint', (_, cwd, trace) => {
		if (trace) trace('Resolving locally');

		return cwd === mockCWD ? stylelintPath : undefined;
	});
};

mockedGlobalPathResolver.mockImplementation(
	() =>
		({
			resolve: jest.fn(async (packageManager: PackageManager) => mockGlobalPaths[packageManager]),
		}) as unknown as GlobalPathResolver,
);

describe('StylelintResolver', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedPath.__mockPlatform();
		mockCWD = mockedPath.join('/fake', 'cwd');
		mockPnPVersion = undefined;
		mockedFS.stat.mockReset();
		mockedFindPackageRoot.mockReset();
	});

	test('should resolve valid custom Stylelint paths', async () => {
		const connection = createMockConnection();
		const stylelintResolver = new StylelintResolver(connection);
		const result = await stylelintResolver.resolve(
			{ stylelintPath: goodStylelintPath },
			createMockTextDocument(),
		);

		expect(result?.resolvedPath).toBe(goodStylelintPath);
		expect(result?.stylelint?.lint({})).toBe('good');
		expect(connection.console.error).not.toHaveBeenCalled();
		expect(connection.window.showErrorMessage).not.toHaveBeenCalled();
		expect(connection.tracer.log).not.toHaveBeenCalled();
	});

	test('should resolve valid relative custom Stylelint paths with a workspace', async () => {
		mockCWD = __dirname;

		const connection = createMockConnection();
		const stylelintResolver = new StylelintResolver(connection);
		const result = await stylelintResolver.resolve(
			{ stylelintPath: './stylelint.js' },
			createMockTextDocument(),
		);

		expect(result?.resolvedPath).toBe(goodStylelintPath);
		expect(result?.stylelint?.lint({})).toBe('good');
		expect(connection.console.error).not.toHaveBeenCalled();
		expect(connection.window.showErrorMessage).not.toHaveBeenCalled();
		expect(connection.tracer.log).not.toHaveBeenCalled();
	});

	test('should resolve valid relative custom Stylelint paths without a workspace', async () => {
		mockCWD = undefined;
		mockedPath.isAbsolute.mockReturnValueOnce(false);

		const connection = createMockConnection();
		const stylelintResolver = new StylelintResolver(connection);
		const result = await stylelintResolver.resolve(
			{ stylelintPath: goodStylelintPath },
			createMockTextDocument(),
		);

		expect(result?.resolvedPath).toBe(goodStylelintPath);
		expect(result?.stylelint?.lint({})).toBe('good');
		expect(connection.console.error).not.toHaveBeenCalled();
		expect(connection.window.showErrorMessage).not.toHaveBeenCalled();
		expect(connection.tracer.log).not.toHaveBeenCalled();
	});

	test('should resolve to undefined for custom Stylelint paths pointing to modules without a lint function', async () => {
		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve(
			{ stylelintPath: badStylelintPath },
			createMockTextDocument(),
		);

		expect(result).toBeUndefined();
		expect(logger.warn).toHaveBeenCalledTimes(2);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(connection.window.showErrorMessage).toHaveBeenCalledTimes(1);
		expect(connection.tracer.log).not.toHaveBeenCalled();
	});

	test('should throw on invalid custom Stylelint paths', async () => {
		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);

		mockCWD = mockedPath.join('.', 'cwd');
		mockedPath.__mockPlatform('posix');

		await expect(
			stylelintResolver.resolve({ stylelintPath: './does-not-exist' }, createMockTextDocument()),
		).rejects.toThrowErrorMatchingSnapshot();
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(connection.window.showErrorMessage).toHaveBeenCalledTimes(1);
		expect(connection.tracer.log).not.toHaveBeenCalled();
	});

	test('should resolve workspace Stylelint modules', async () => {
		mockLocalFileResolution(goodStylelintPath);

		const connection = createMockConnection();
		const stylelintResolver = new StylelintResolver(connection);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(result?.resolvedPath).toBe(goodStylelintPath);
		expect(result?.stylelint?.lint({})).toBe('good');
		expect(connection.console.error).not.toHaveBeenCalled();
		expect(connection.window.showErrorMessage).not.toHaveBeenCalled();
		expect(connection.tracer.log).toHaveBeenCalledTimes(1);
	});

	test('should resolve workspace Stylelint modules for documents with non-file URIs', async () => {
		mockLocalFileResolution(goodStylelintPath);

		const connection = createMockConnection();
		const stylelintResolver = new StylelintResolver(connection);
		const result = await stylelintResolver.resolve({}, createMockTextDocument(true));

		expect(result?.resolvedPath).toBe(goodStylelintPath);
		expect(result?.stylelint?.lint({})).toBe('good');
		expect(connection.console.error).not.toHaveBeenCalled();
		expect(connection.window.showErrorMessage).not.toHaveBeenCalled();
		expect(connection.tracer.log).toHaveBeenCalledTimes(1);
	});

	test('should resolve global Stylelint modules using yarn', async () => {
		mockGlobalFileResolution('yarn', goodStylelintPath);

		const connection = createMockConnection();
		const stylelintResolver = new StylelintResolver(connection);
		const result = await stylelintResolver.resolve(
			{ packageManager: 'yarn' },
			createMockTextDocument(),
		);

		expect(result?.resolvedPath).toBe(goodStylelintPath);
		expect(result?.stylelint?.lint({})).toBe('good');
		expect(connection.console.error).not.toHaveBeenCalled();
		expect(connection.window.showErrorMessage).not.toHaveBeenCalled();
		expect(connection.tracer.log).toHaveBeenCalledTimes(1);
	});

	test('should resolve global Stylelint modules using npm', async () => {
		mockGlobalFileResolution('npm', goodStylelintPath);

		const connection = createMockConnection();
		const stylelintResolver = new StylelintResolver(connection);
		const result = await stylelintResolver.resolve(
			{ packageManager: 'npm' },
			createMockTextDocument(),
		);

		expect(result?.resolvedPath).toBe(goodStylelintPath);
		expect(result?.stylelint?.lint({})).toBe('good');
		expect(connection.console.error).not.toHaveBeenCalled();
		expect(connection.window.showErrorMessage).not.toHaveBeenCalled();
		expect(connection.tracer.log).toHaveBeenCalledTimes(1);
	});

	test('should resolve global Stylelint modules using pnpm', async () => {
		mockGlobalFileResolution('pnpm', goodStylelintPath);

		const connection = createMockConnection();
		const stylelintResolver = new StylelintResolver(connection);
		const result = await stylelintResolver.resolve(
			{ packageManager: 'pnpm' },
			createMockTextDocument(),
		);

		expect(result?.resolvedPath).toBe(goodStylelintPath);
		expect(result?.stylelint?.lint({})).toBe('good');
		expect(connection.console.error).not.toHaveBeenCalled();
		expect(connection.window.showErrorMessage).not.toHaveBeenCalled();
		expect(connection.tracer.log).toHaveBeenCalledTimes(1);
	});

	test('should return undefined when no Stylelint module is found globally or in the workspace', async () => {
		mockedFiles.__resetMockedResolutions();

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(result).toBeUndefined();
		expect(logger.warn).toHaveBeenCalledTimes(2);
		expect(connection.window.showErrorMessage).not.toHaveBeenCalled();
		expect(connection.tracer.log).not.toHaveBeenCalled();
	});

	test('should resolve workspace Stylelint modules using PnP', async () => {
		mockCWD = mockedPath.join('/fake', 'pnp');
		mockedFindPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockResolvedValueOnce({
			isFile: () => true,
		} as unknown as Stats);
		mockedModule.createRequire.mockImplementation(
			() =>
				Object.assign(() => ({ lint: () => 'from pnp' }), {
					resolve: () => goodStylelintPath,
				}) as unknown as NodeRequire,
		);

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(mockedPnP.setup).toHaveBeenCalledTimes(1);
		expect(logger.debug).toHaveBeenCalledWith('Resolved Stylelint using PnP', {
			path: pnpPath,
		});
		expect(result?.resolvedPath).toBe(__dirname);
		expect(result?.stylelint?.lint({})).toBe('from pnp');
	});

	test('should resolve workspace Stylelint modules using a PnP loader named .pnp.js (Yarn 2)', async () => {
		mockCWD = mockedPath.join('/fake', 'pnp');
		mockedFindPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockImplementation(async (filePath) => {
			if (filePath.toString().endsWith('.pnp.js')) {
				return { isFile: () => true } as unknown as Stats;
			}

			throw new Error('Not found!');
		});

		mockedModule.createRequire.mockImplementation(
			() =>
				Object.assign(() => ({ lint: () => 'from pnp' }), {
					resolve: () => goodStylelintPath,
				}) as unknown as NodeRequire,
		);

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(mockedJSPnP.setup).toHaveBeenCalledTimes(1);
		expect(logger.debug).toHaveBeenCalledWith('Resolved Stylelint using PnP', {
			path: pnpJSPath,
		});
		expect(result?.resolvedPath).toBe(__dirname);
		expect(result?.stylelint?.lint({})).toBe('from pnp');
	});

	test('should not try to setup PnP if it is already setup', async () => {
		mockCWD = mockedPath.join('/fake', 'pnp');
		mockedFindPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockResolvedValueOnce({
			isFile: () => true,
		} as unknown as Stats);
		mockedModule.createRequire.mockImplementation(
			() =>
				Object.assign(() => ({ lint: () => 'from pnp' }), {
					resolve: () => goodStylelintPath,
				}) as unknown as NodeRequire,
		);
		mockPnPVersion = '1.0.0';

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);

		await stylelintResolver.resolve({}, createMockTextDocument());

		expect(mockedPnP.setup).toHaveBeenCalledTimes(0);
	});

	test("should resolve to undefined if PnP setup fails and Stylelint can't be resolved from node_modules", async () => {
		const error = new Error('PnP setup failed');

		mockCWD = mockedPath.join('/fake', 'pnp');
		mockedFindPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockResolvedValueOnce({
			isFile: () => true,
		} as unknown as Stats);
		mockedPnP.setup.mockImplementationOnce(() => {
			throw error;
		});
		mockedModule.createRequire.mockImplementation(
			() =>
				Object.assign(() => ({ lint: () => 'from pnp' }), {
					resolve: () => goodStylelintPath,
				}) as unknown as NodeRequire,
		);

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(mockedPnP.setup).toHaveBeenCalledTimes(1);
		expect(logger.warn).toHaveBeenCalledWith('Could not setup PnP', {
			path: pnpPath,
			error,
		});
		expect(result).toBeUndefined();
	});

	test("should resolve to undefined if PnP loader isn't a file and Stylelint can't be resolved from node_modules", async () => {
		mockCWD = mockedPath.join('/fake', 'pnp');
		mockedFindPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockResolvedValueOnce({
			isFile: () => false,
		} as unknown as Stats);
		mockedModule.createRequire.mockImplementation(
			() =>
				Object.assign(() => ({ lint: () => 'from pnp' }), {
					resolve: () => goodStylelintPath,
				}) as unknown as NodeRequire,
		);

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(mockedPnP.setup).not.toHaveBeenCalled();
		expect(logger.debug).toHaveBeenCalledWith('Could not find a PnP loader', {
			path: __dirname,
		});
		expect(result).toBeUndefined();
	});

	test("should resolve to undefined if PnP loader can't be found and Stylelint can't be resolved from node_modules", async () => {
		const error = new Error('EACCES');

		mockCWD = mockedPath.join('/fake', 'pnp');
		mockedFindPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockRejectedValueOnce(error);
		mockedModule.createRequire.mockImplementation(
			() =>
				Object.assign(() => ({ lint: () => 'from pnp' }), {
					resolve: () => goodStylelintPath,
				}) as unknown as NodeRequire,
		);

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(mockedPnP.setup).not.toHaveBeenCalled();
		expect(logger.debug).toHaveBeenCalledWith('Could not find a PnP loader', {
			path: __dirname,
		});
		expect(result).toBeUndefined();
	});

	test("should resolve to undefined if Stylelint can't be required using PnP", async () => {
		const error = new Error('Cannot find module');

		mockCWD = mockedPath.join('/fake', 'pnp');
		mockedFindPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockResolvedValueOnce({
			isFile: () => true,
		} as unknown as Stats);
		mockedPnP.setup.mockImplementationOnce(() => {
			mockedModule.createRequire.mockImplementationOnce(
				() =>
					Object.assign(
						() => {
							throw error;
						},
						{
							resolve: () => {
								throw error;
							},
						},
					) as unknown as NodeRequire,
			);
		});

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(mockedPnP.setup).toHaveBeenCalledTimes(1);
		expect(logger.warn).toHaveBeenCalledWith('Could not load Stylelint using PnP', {
			path: __dirname,
			error,
		});
		expect(result).toBeUndefined();
	});

	test("should resolve to undefined if Stylelint path can't be determined using PnP", async () => {
		mockCWD = mockedPath.join('/fake', 'pnp');
		mockedFindPackageRoot.mockImplementation((startPath) =>
			Promise.resolve(startPath === mockedPath.join('/fake', 'cwd') ? __dirname : undefined),
		);
		mockedFS.stat.mockResolvedValueOnce({
			isFile: () => true,
		} as unknown as Stats);
		mockedModule.createRequire.mockImplementation(
			() =>
				Object.assign(() => ({ lint: () => 'from pnp' }), {
					resolve: () => goodStylelintPath,
				}) as unknown as NodeRequire,
		);

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(mockedPnP.setup).toHaveBeenCalledTimes(1);
		expect(logger.warn).toHaveBeenCalledWith('Failed to find the Stylelint package root', {
			path: goodStylelintPath,
		});
		expect(result).toBeUndefined();
	});

	test('should resolve to undefined if an error is thrown during resolution', async () => {
		mockedFindPackageRoot.mockRejectedValueOnce(new Error());

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument(true));

		expect(result).toBeUndefined();
	});

	test("should resolve to undefined if cwd can't be determined and Stylelint can't be resolved from node_modules", async () => {
		mockCWD = undefined;

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument(true));

		expect(result).toBeUndefined();
	});

	test('should work without a connection', async () => {
		mockGlobalFileResolution('npm', goodStylelintPath);

		let result = await new StylelintResolver().resolve(
			{ packageManager: 'npm' },
			createMockTextDocument(),
		);

		expect(result?.resolvedPath).toBe(goodStylelintPath);
		expect(result?.stylelint?.lint({})).toBe('good');

		mockGlobalFileResolution('npm', badStylelintPath);

		result = await new StylelintResolver().resolve(
			{ packageManager: 'npm' },
			createMockTextDocument(),
		);

		expect(result).toBeUndefined();

		await expect(
			new StylelintResolver().resolve(
				{ stylelintPath: './does-not-exist' },
				createMockTextDocument(),
			),
		).rejects.toThrowErrorMatchingSnapshot();
	});
});
