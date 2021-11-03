'use strict';

jest.mock('vscode-languageserver/node');
jest.mock('../global-path-resolver');
jest.mock('../find-package-root');
jest.mock('path');
jest.mock('fs/promises', () => jest.createMockFromModule('fs/promises'));
jest.mock('module');

const path = /** @type {tests.mocks.PathModule} */ (require('path'));

const mockedFS = /** @type {jest.Mocked<typeof import('fs/promises')>} */ (require('fs/promises'));

const mockedModule = /** @type {jest.Mocked<typeof import('module')>} */ (require('module'));

const { findPackageRoot } = /** @type {jest.Mocked<typeof import('../find-package-root')>} */ (
	require('../find-package-root')
);

/** @type {string | undefined} */
let mockCWD = path.join('/fake', 'cwd');

/** @type {string | undefined} */
let mockPnPVersion = undefined;

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

const { StylelintResolver } = require('../stylelint-resolver');

/** @returns {lsp.Connection} */
const createMockConnection = () =>
	/** @type {any} */ ({
		console: { error: jest.fn() },
		window: { showErrorMessage: jest.fn() },
		tracer: { log: jest.fn() },
	});

/** @returns {winston.Logger} */
const createMockLogger = () =>
	/** @type {any} */ ({
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	});

/** @returns {lsp.TextDocument} */
const createMockTextDocument = (nonFileURI = false) =>
	/** @type {any} */ ({
		uri: nonFileURI ? 'scheme:///fake/cwd/document.css' : 'file:///fake/cwd/document.css',
	});

const goodStylelintPath = path.join(__dirname, 'stylelint.js');
const badStylelintPath = path.join(__dirname, 'bad-stylelint.js');

const pnpPath = path.join(__dirname, '.pnp.cjs');
const pnpJSPath = path.join(__dirname, '.pnp.js');

/** @type {{[packageManager in PackageManager]: string}} */
const mockGlobalPaths = {
	yarn: path.join('/fake', 'yarn'),
	npm: path.join('/fake', 'npm'),
	pnpm: path.join('/fake', 'pnpm'),
};

jest.mock(
	require('path').join(__dirname, 'stylelint.js'),
	() => ({ lint: jest.fn(() => 'good') }),
	{ virtual: true },
);
jest.mock(require('path').join(__dirname, 'bad-stylelint.js'), () => ({}), { virtual: true });
jest.mock(require('path').join(__dirname, '.pnp.cjs'), () => ({ setup: jest.fn() }), {
	virtual: true,
});
jest.mock(require('path').join(__dirname, '.pnp.js'), () => ({ setup: jest.fn() }), {
	virtual: true,
});

const mockedPnP = /** @type {jest.Mocked<{ setup: () => void }>} */ (require(pnpPath));
const mockedJSPnP = /** @type {jest.Mocked<{ setup: () => void }>} */ (require(pnpJSPath));

const { Files: mockedFiles } = /** @type {tests.mocks.VSCodeLanguageServerModule.Node} */ (
	require('vscode-languageserver/node')
);

/**
 * @param {PackageManager} packageManager
 * @param {string} stylelintPath
 */
const mockGlobalFileResolution = (packageManager, stylelintPath) => {
	mockedFiles.__mockResolution('stylelint', (globalPath, cwd, trace) => {
		trace && trace('Resolving globally');

		return cwd === mockCWD && globalPath === mockGlobalPaths[packageManager]
			? stylelintPath
			: undefined;
	});
};

/**
 * @param {string} [stylelintPath]
 */
const mockLocalFileResolution = (stylelintPath) => {
	mockedFiles.__mockResolution('stylelint', (_, cwd, trace) => {
		trace && trace('Resolving locally');

		return cwd === mockCWD ? stylelintPath : undefined;
	});
};

const mockedGlobalPathResolver = /** @type {tests.mocks.GlobalPathResolver} */ (
	require('../global-path-resolver')
);

describe('StylelintResolver', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockLocalFileResolution();
		path.__mockPlatform();
		mockCWD = path.join('/fake', 'cwd');
		mockPnPVersion = undefined;
		mockedFS.stat.mockReset();
		findPackageRoot.mockReset();
		Object.defineProperty(process.versions, 'pnp', { value: undefined });
		mockedGlobalPathResolver.__mockPath('yarn', mockGlobalPaths.yarn);
		mockedGlobalPathResolver.__mockPath('npm', mockGlobalPaths.npm);
		mockedGlobalPathResolver.__mockPath('pnpm', mockGlobalPaths.pnpm);
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
		path.isAbsolute.mockReturnValueOnce(false);

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
		expect(connection.tracer.log).toHaveBeenCalledTimes(1);
	});

	test('should throw on invalid custom Stylelint paths', async () => {
		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);

		mockCWD = path.join('.', 'cwd');
		path.__mockPlatform('posix');

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
		mockCWD = path.join('/fake', 'pnp');
		findPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockResolvedValueOnce(/** @type {any} */ ({ isFile: () => true }));
		mockedModule.createRequire.mockImplementation(
			() =>
				/** @type {any} */ (
					Object.assign(() => ({ lint: () => 'from pnp' }), { resolve: () => goodStylelintPath })
				),
		);

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(mockedPnP.setup).toHaveBeenCalledTimes(1);
		expect(logger.debug).toHaveBeenCalledWith('Resolved Stylelint using PnP', { path: pnpPath });
		expect(result?.resolvedPath).toBe(__dirname);
		expect(result?.stylelint?.lint({})).toBe('from pnp');
	});

	test('should resolve workspace Stylelint modules using a PnP loader named .pnp.js (Yarn 2)', async () => {
		mockCWD = path.join('/fake', 'pnp');
		findPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockImplementation(
			async (filePath) =>
				/** @type {any} */ (
					filePath.toString().endsWith('.pnp.js') ? { isFile: () => true } : new Error('Not found!')
				),
		);
		mockedModule.createRequire.mockImplementation(
			() =>
				/** @type {any} */ (
					Object.assign(() => ({ lint: () => 'from pnp' }), { resolve: () => goodStylelintPath })
				),
		);

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(mockedJSPnP.setup).toHaveBeenCalledTimes(1);
		expect(logger.debug).toHaveBeenCalledWith('Resolved Stylelint using PnP', { path: pnpJSPath });
		expect(result?.resolvedPath).toBe(__dirname);
		expect(result?.stylelint?.lint({})).toBe('from pnp');
	});

	test('should not try to setup PnP if it is already setup', async () => {
		mockCWD = path.join('/fake', 'pnp');
		findPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockResolvedValueOnce(/** @type {any} */ ({ isFile: () => true }));
		mockedModule.createRequire.mockImplementation(
			() =>
				/** @type {any} */ (
					Object.assign(() => ({ lint: () => 'from pnp' }), { resolve: () => goodStylelintPath })
				),
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

		mockCWD = path.join('/fake', 'pnp');
		findPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockResolvedValueOnce(/** @type {any} */ ({ isFile: () => true }));
		mockedPnP.setup.mockImplementationOnce(() => {
			throw error;
		});
		mockedModule.createRequire.mockImplementation(
			() =>
				/** @type {any} */ (
					Object.assign(() => ({ lint: () => 'from pnp' }), { resolve: () => goodStylelintPath })
				),
		);
		Object.defineProperty(process.versions, 'pnp', { value: undefined });

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(mockedPnP.setup).toHaveBeenCalledTimes(1);
		expect(logger.warn).toHaveBeenCalledWith('Could not setup PnP', { path: pnpPath, error });
		expect(result).toBeUndefined();
	});

	test("should resolve to undefined if PnP loader isn't a file and Stylelint can't be resolved from node_modules", async () => {
		mockCWD = path.join('/fake', 'pnp');
		findPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockResolvedValueOnce(/** @type {any} */ ({ isFile: () => false }));
		mockedModule.createRequire.mockImplementation(
			() =>
				/** @type {any} */ (
					Object.assign(() => ({ lint: () => 'from pnp' }), { resolve: () => goodStylelintPath })
				),
		);
		Object.defineProperty(process.versions, 'pnp', { value: undefined });

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument());

		expect(mockedPnP.setup).not.toHaveBeenCalled();
		expect(logger.debug).toHaveBeenCalledWith('Could not find a PnP loader', { path: __dirname });
		expect(result).toBeUndefined();
	});

	test("should resolve to undefined if PnP loader can't be found and Stylelint can't be resolved from node_modules", async () => {
		const error = new Error('EACCES');

		mockCWD = path.join('/fake', 'pnp');
		findPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockRejectedValueOnce(error);
		mockedModule.createRequire.mockImplementation(
			() =>
				/** @type {any} */ (
					Object.assign(() => ({ lint: () => 'from pnp' }), { resolve: () => goodStylelintPath })
				),
		);
		Object.defineProperty(process.versions, 'pnp', { value: undefined });

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

		mockCWD = path.join('/fake', 'pnp');
		findPackageRoot.mockResolvedValue(__dirname);
		mockedFS.stat.mockResolvedValueOnce(/** @type {any} */ ({ isFile: () => true }));
		mockedPnP.setup.mockImplementationOnce(() => {
			mockedModule.createRequire.mockImplementationOnce(
				() =>
					/** @type {any} */ (
						Object.assign(
							() => {
								throw error;
							},
							{
								resolve: () => {
									throw error;
								},
							},
						)
					),
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
		mockCWD = path.join('/fake', 'pnp');
		findPackageRoot.mockImplementation(async (startPath) =>
			startPath === path.join('/fake', 'cwd') ? __dirname : undefined,
		);
		mockedFS.stat.mockResolvedValueOnce(/** @type {any} */ ({ isFile: () => true }));
		mockedModule.createRequire.mockImplementation(
			() =>
				/** @type {any} */ (
					Object.assign(() => ({ lint: () => 'from pnp' }), { resolve: () => goodStylelintPath })
				),
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
		findPackageRoot.mockRejectedValueOnce(new Error());

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve({}, createMockTextDocument(true));

		expect(result).toBeUndefined();
	});

	test('should resolve to undefined if an error is thrown during global path resolution and no workspace module exists', async () => {
		mockLocalFileResolution();

		const error = new Error('error');

		mockedGlobalPathResolver.__mockPath('yarn', error);

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve(
			{ packageManager: 'yarn' },
			createMockTextDocument(),
		);

		expect(result).toBeUndefined();
		expect(logger.warn).toHaveBeenCalledWith('Failed to resolve global node_modules path', {
			error,
		});
	});

	test('should resolve workspace Stylelint if an error is thrown during global path resolution and a workspace module exists', async () => {
		mockLocalFileResolution(goodStylelintPath);

		const error = new Error('error');

		mockedGlobalPathResolver.__mockPath('yarn', error);

		const connection = createMockConnection();
		const logger = createMockLogger();
		const stylelintResolver = new StylelintResolver(connection, logger);
		const result = await stylelintResolver.resolve(
			{ packageManager: 'yarn' },
			createMockTextDocument(),
		);

		expect(result?.resolvedPath).toBe(goodStylelintPath);
		expect(result?.stylelint?.lint({})).toBe('good');
		expect(logger.warn).toHaveBeenCalledWith('Failed to resolve global node_modules path', {
			error,
		});
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
