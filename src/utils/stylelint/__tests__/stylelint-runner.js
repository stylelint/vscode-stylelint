'use strict';

jest.mock('os');
jest.mock('path');
jest.mock('vscode-uri', () => ({
	URI: {
		parse: jest.fn((/** @type {string} */ str) => ({ fsPath: str })),
	},
}));
jest.mock('../../packages/stylelint-resolver');
jest.mock('../../documents');

const stylelint = require('stylelint');

const mockedOS = /** @type {tests.mocks.OSModule} */ (require('os'));
const mockedPath = /** @type {tests.mocks.PathModule} */ (require('path'));
const resolver = /** @type {jest.Mocked<typeof import('../../packages/stylelint-resolver')>} */ (
	require('../../packages/stylelint-resolver')
);

const mockedDocuments = /** @type {jest.Mocked<typeof import('../../documents')>} */ (
	require('../../documents')
);

const { StylelintRunner } = require('../stylelint-runner');

/** @typedef {(options: stylelint.LinterOptions) => Promise<Partial<stylelint.LinterResult>>} FakeLintFunction */

/**
 * @param {FakeLintFunction} [lint]
 * @param {(serverOptions: ResolverOptions, document: lsp.TextDocument) => Promise<{lint: FakeLintFunction}>} [resolve]
 * @returns {() => import('../../packages/stylelint-resolver').StylelintResolver}
 */
const createMockResolver = (lint, resolve) =>
	/** @type {any} */ (
		() => ({
			resolve: resolve ?? (async () => (lint ? { lint } : undefined)),
		})
	);

/**
 * @param {string} code
 * @param {string} [uri]
 * @returns {lsp.TextDocument}
 */
const createMockDocument = (code, uri = '/path/to/file.css') =>
	/** @type {lsp.TextDocument} */ ({
		getText: () => code,
		uri,
	});

/** @type {lsp.Connection} */
const mockConnection = /** @type {any} */ ({});

describe('StylelintRunner', () => {
	beforeEach(() => {
		mockedOS.__mockPlatform('linux');
		mockedPath.__mockPlatform('posix');
	});

	test('should return no diagnostics if Stylelint cannot be resolved', async () => {
		resolver.StylelintResolver.mockImplementation(createMockResolver());

		const results = await new StylelintRunner(mockConnection).lintDocument(createMockDocument(''));

		expect(results).toEqual({ diagnostics: [] });
	});

	// TODO: Remove once fixed upstream
	test('should upper-case drive letters on Windows (Stylelint bug #5594)', async () => {
		expect.assertions(2);

		mockedOS.__mockPlatform('win32');
		resolver.StylelintResolver.mockImplementation(
			createMockResolver(async (options) => {
				expect(options.codeFilename).toBe('C:\\path\\to\\file.css');

				return { results: [] };
			}),
		);

		await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('', 'c:\\path\\to\\file.css'),
		);

		mockedOS.__mockPlatform('linux');
		resolver.StylelintResolver.mockImplementation(
			createMockResolver(async (options) => {
				expect(options.codeFilename).toBe('c:/path/to/file.css');

				return { results: [] };
			}),
		);

		await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('', 'c:/path/to/file.css'),
		);
	});

	test('should call stylelint.lint with the document path and given options', async () => {
		expect.assertions(2);

		resolver.StylelintResolver.mockImplementation(
			createMockResolver(async (options) => {
				expect(options).toMatchSnapshot();

				expect(/** @type {stylelint.Formatter} */ (options.formatter)?.([])).toBe('');

				return { results: [] };
			}),
		);

		await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('a {}', '/path/to/file.scss'),
			{
				config: {
					customSyntax: 'postcss-scss',
				},
				fix: true,
			},
		);
	});

	test("should pass empty rules if the document's path cannot be determined and rules aren't set", async () => {
		expect.assertions(1);

		resolver.StylelintResolver.mockImplementation(
			createMockResolver(async (options) => {
				expect(options.config).toEqual({
					rules: {},
				});

				return { results: [] };
			}),
		);

		await new StylelintRunner(mockConnection).lintDocument(createMockDocument('a {}', ''));
	});

	test("should not change set rules if the document's path cannot be determined", async () => {
		expect.assertions(1);

		resolver.StylelintResolver.mockImplementation(
			createMockResolver(async (options) => {
				expect(options.config).toEqual({
					rules: { 'no-empty-source': true },
				});

				return { results: [] };
			}),
		);

		await new StylelintRunner(mockConnection).lintDocument(createMockDocument('a {}', ''), {
			config: { rules: { 'no-empty-source': true } },
		});
	});

	test('should call the resolver with the server options and the document', async () => {
		expect.assertions(3);

		resolver.StylelintResolver.mockImplementation(
			createMockResolver(undefined, async (serverOptions, document) => {
				expect(serverOptions).toEqual({
					packageManager: 'pnpm',
				});

				expect(document).toEqual({
					getText: expect.any(Function),
					uri: '/path/to/file.css',
				});

				expect(document.getText()).toBe('a {}');

				return {
					lint: async () => ({ results: [] }),
				};
			}),
		);

		await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('a {}', '/path/to/file.css'),
			undefined,
			{ packageManager: 'pnpm' },
		);
	});

	test('with stylelintPath, if the path is absolute, should call the resolver with the path', async () => {
		expect.assertions(1);

		mockedDocuments.getWorkspaceFolder.mockResolvedValueOnce('/workspace');

		resolver.StylelintResolver.mockImplementation(
			createMockResolver(undefined, async (serverOptions) => {
				expect(serverOptions).toEqual({
					stylelintPath: '/path/to/stylelint',
				});

				return {
					lint: async () => ({ results: [] }),
				};
			}),
		);

		await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('a {}', '/path/to/file.css'),
			undefined,
			{ stylelintPath: '/path/to/stylelint' },
		);
	});

	test('with stylelintPath, if the path is relative, should make it absolute using the workspace path', async () => {
		expect.assertions(1);

		mockedDocuments.getWorkspaceFolder.mockResolvedValueOnce('/workspace');

		resolver.StylelintResolver.mockImplementation(
			createMockResolver(undefined, async (serverOptions) => {
				expect(serverOptions).toEqual({
					stylelintPath: '/workspace/path/to/stylelint',
				});

				return {
					lint: async () => ({ results: [] }),
				};
			}),
		);

		await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('a {}', '/path/to/file.css'),
			undefined,
			{ stylelintPath: 'path/to/stylelint' },
		);
	});

	test('with stylelintPath, if the path is relative and no workspace folder is found, should keep the path relative', async () => {
		expect.assertions(1);

		mockedDocuments.getWorkspaceFolder.mockResolvedValueOnce(undefined);

		resolver.StylelintResolver.mockImplementation(
			createMockResolver(undefined, async (serverOptions) => {
				expect(serverOptions).toEqual({
					stylelintPath: 'path/to/stylelint',
				});

				return {
					lint: async () => ({ results: [] }),
				};
			}),
		);

		await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('a {}', '/path/to/file.css'),
			undefined,
			{ stylelintPath: 'path/to/stylelint' },
		);
	});

	test('should return processed lint results from Stylelint without configured rules', async () => {
		expect.assertions(1);

		mockedPath.__mockPlatform();

		resolver.StylelintResolver.mockImplementation(
			createMockResolver(undefined, async () => stylelint),
		);

		const results = await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('table {', '/path/to/file.css'),
		);

		expect(results).toMatchSnapshot();
	});

	test('should return processed lint results from Stylelint with configured rules', async () => {
		expect.assertions(1);

		mockedPath.__mockPlatform();

		resolver.StylelintResolver.mockImplementation(
			createMockResolver(undefined, async () => stylelint),
		);

		const results = await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('a {}', '/path/to/file.css'),
			{ config: { rules: { 'block-no-empty': true } } },
		);

		expect(results).toMatchSnapshot();
	});

	test('should throw errors thrown by Stylelint', async () => {
		expect.assertions(1);

		mockedPath.__mockPlatform();

		resolver.StylelintResolver.mockImplementation(
			createMockResolver(undefined, async () => stylelint),
		);

		await expect(
			new StylelintRunner(mockConnection).lintDocument(
				createMockDocument('a {}', '/path/to/file.css'),
				{
					config: { rules: {} },
					files: ['/path/to/file.css'],
				},
			),
		).rejects.toThrowErrorMatchingSnapshot();
	});

	test('should log if a logger is provided', async () => {
		expect.assertions(2);

		const mockLogger = /** @type {winston.Logger} */ (
			/** @type {unknown} */ ({
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				isDebugEnabled: jest.fn(() => true),
			})
		);

		mockedPath.__mockPlatform();

		resolver.StylelintResolver.mockImplementation(
			createMockResolver(undefined, async () => stylelint),
		);

		await new StylelintRunner(mockConnection, mockLogger).lintDocument(
			createMockDocument('a {}', '/path/to/file.css'),
			{ config: { rules: { 'block-no-empty': true } } },
		);

		expect(mockLogger.debug).toHaveBeenCalledTimes(1);
		expect(mockLogger.debug).toHaveBeenCalledWith(
			expect.stringMatching(/^Running Stylelint/),
			expect.any(Object),
		);
	});
});
