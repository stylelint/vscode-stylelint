jest.mock('os');
jest.mock('path');
jest.mock('vscode-uri', () => ({
	URI: {
		parse: jest.fn((str: string) => ({ fsPath: str })),
	},
}));
jest.mock('../../packages/stylelint-resolver');
jest.mock('../../documents');

import os from 'os';
import path from 'path';
import stylelint from 'stylelint';
import type winston from 'winston';
import type { Connection } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { StylelintResolver, ResolverOptions } from '../../packages/index';
import { getWorkspaceFolder } from '../../documents/index';
import { StylelintRunner } from '../stylelint-runner';

const mockedOS = os as tests.mocks.OSModule;
const mockedPath = path as tests.mocks.PathModule;
const mockedResolver = StylelintResolver as jest.Mock<StylelintResolver>;
const mockedGetWorkspaceFolder = getWorkspaceFolder as jest.MockedFunction<
	typeof getWorkspaceFolder
>;

type FakeLintFunction = (
	options: stylelint.LinterOptions,
) => Promise<Partial<stylelint.LinterResult>>;

type FakeResolveFunction = (
	serverOptions: ResolverOptions,
	document: TextDocument,
) => Promise<{ stylelint: { lint: FakeLintFunction } }>;

const createMockResolver =
	(lint?: FakeLintFunction, resolve?: FakeResolveFunction): (() => StylelintResolver) =>
	() =>
		({
			resolve: resolve ?? (() => Promise.resolve(lint ? { stylelint: { lint } } : undefined)),
		} as unknown as StylelintResolver);

const createMockDocument = (code: string, uri = '/path/to/file.css'): TextDocument =>
	({
		getText: () => code,
		uri,
	} as TextDocument);

const mockConnection = {} as unknown as Connection;

describe('StylelintRunner', () => {
	beforeEach(() => {
		mockedOS.__mockPlatform('linux');
		mockedPath.__mockPlatform('posix');
	});

	test('should return no diagnostics if Stylelint cannot be resolved', async () => {
		mockedResolver.mockImplementation(createMockResolver());

		const results = await new StylelintRunner(mockConnection).lintDocument(createMockDocument(''));

		expect(results).toEqual({ diagnostics: [] });
	});

	// TODO: Remove once fixed upstream
	test('should upper-case drive letters on Windows (Stylelint bug #5594)', async () => {
		expect.assertions(2);

		mockedOS.__mockPlatform('win32');
		mockedResolver.mockImplementation(
			createMockResolver(async (options) => {
				expect(options.codeFilename).toBe('C:\\path\\to\\file.css');

				return { results: [] };
			}),
		);

		await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('', 'c:\\path\\to\\file.css'),
		);

		mockedOS.__mockPlatform('linux');
		mockedResolver.mockImplementation(
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

		mockedResolver.mockImplementation(
			createMockResolver(async (options) => {
				expect(options).toMatchSnapshot();

				expect((options.formatter as stylelint.Formatter)?.([], {} as never)).toBe('');

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

		mockedResolver.mockImplementation(
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

		mockedResolver.mockImplementation(
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

		mockedResolver.mockImplementation(
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
					stylelint: { lint: async () => ({ results: [] }) },
				};
			}),
		);

		await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('a {}', '/path/to/file.css'),
			undefined,
			{ packageManager: 'pnpm' },
		);
	});

	test('with stylelintPath, should call the resolver with the path', async () => {
		expect.assertions(1);

		mockedGetWorkspaceFolder.mockResolvedValueOnce('/workspace');

		mockedResolver.mockImplementation(
			createMockResolver(undefined, async (serverOptions) => {
				expect(serverOptions).toEqual({
					stylelintPath: '/path/to/stylelint',
				});

				return {
					stylelint: { lint: async () => ({ results: [] }) },
				};
			}),
		);

		await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('a {}', '/path/to/file.css'),
			undefined,
			{ stylelintPath: '/path/to/stylelint' },
		);
	});

	test('should return processed lint results from Stylelint without configured rules', async () => {
		expect.assertions(1);

		mockedPath.__mockPlatform();

		mockedResolver.mockImplementation(createMockResolver(undefined, async () => ({ stylelint })));

		const results = await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('table {', '/path/to/file.css'),
		);

		expect(results).toMatchSnapshot();
	});

	test('should return processed lint results from Stylelint with configured rules', async () => {
		expect.assertions(1);

		mockedPath.__mockPlatform();

		mockedResolver.mockImplementation(createMockResolver(undefined, async () => ({ stylelint })));

		const results = await new StylelintRunner(mockConnection).lintDocument(
			createMockDocument('a {}', '/path/to/file.css'),
			{ config: { rules: { 'block-no-empty': true } } },
		);

		expect(results).toMatchSnapshot();
	});

	test('should throw errors thrown by Stylelint', async () => {
		expect.assertions(1);

		mockedPath.__mockPlatform();

		mockedResolver.mockImplementation(createMockResolver(undefined, async () => ({ stylelint })));

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

		const mockLogger = {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			isDebugEnabled: jest.fn(() => true),
		} as unknown as winston.Logger;

		mockedPath.__mockPlatform();

		mockedResolver.mockImplementation(createMockResolver(undefined, async () => ({ stylelint })));

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
