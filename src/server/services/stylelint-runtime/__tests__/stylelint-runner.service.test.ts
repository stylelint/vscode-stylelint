import path from 'node:path';
import semver from 'semver';
import type stylelint from 'stylelint';
import { version as stylelintVersion } from 'stylelint/package.json';
import { beforeEach, describe, expect, it, test, vi } from 'vitest';
import type { Connection } from 'vscode-languageserver';
import type { FileEvent } from 'vscode-languageserver-protocol';
import * as LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import type winston from 'winston';
import { snapshotLintDiagnostics } from '../../../../../test/helpers/snapshots.js';
import { createTestLogger } from '../../../../../test/helpers/test-logger.js';
import type { LinterResult, StylelintResolutionResult } from '../../../stylelint/types.js';
import {
	StylelintNotFoundError,
	StylelintWorkerUnavailableError,
} from '../../../worker/worker-process.js';
import type { LoggingService } from '../../infrastructure/logging.service.js';
import type { WorkspaceFolderService } from '../../workspace/workspace-folder.service.js';
import { PackageRootService } from '../package-root.service.js';
import { StylelintOptionsService } from '../stylelint-options.service.js';
import { StylelintRunnerService } from '../stylelint-runner.service.js';
import type { WorkspaceStylelintService } from '../workspace-stylelint.service.js';

type WorkspaceFolderServiceStub = Pick<WorkspaceFolderService, 'getWorkspaceFolder'>;
type WorkspaceFolderMock = ReturnType<
	typeof vi.fn<WorkspaceFolderServiceStub['getWorkspaceFolder']>
>;

type RunnerDependencyOverrides = {
	os?: typeof import('node:os');
	path?: typeof path;
	uri?: typeof URI;
	workspaceFolderService?: WorkspaceFolderServiceStub;
	connection?: Connection;
	loggingService?: LoggingService;
};

let getWorkspaceFolderMock: WorkspaceFolderMock =
	vi.fn<WorkspaceFolderServiceStub['getWorkspaceFolder']>();
const mockConnection = {} as unknown as Connection;

const defaultResolution: StylelintResolutionResult = {
	entryPath: '/global/node_modules/stylelint/index.js',
	resolvedPath: '/global/node_modules/stylelint',
};

const createWorkspaceService = (
	overrides: Partial<WorkspaceStylelintService> = {},
): WorkspaceStylelintService =>
	({
		lint: vi.fn(async () => undefined),
		resolve: vi.fn(async () => undefined),
		dispose: vi.fn(),
		disposeAll: vi.fn(),
		notifyWorkspaceActivity: vi.fn(),
		notifyFileActivity: vi.fn(),
		...overrides,
	}) as WorkspaceStylelintService;

const createOsMock = (platform: NodeJS.Platform = 'linux') =>
	({
		platform: () => platform,
	}) as typeof import('node:os');

const createUriMock = () =>
	({
		parse: (value: string) => ({ fsPath: value }),
	}) as typeof URI;

const createTestOptionsBuilder = () => {
	return new StylelintOptionsService(
		path.posix,
		(child: string, parent: string) => {
			const normalizedParent = parent.endsWith('/') ? parent : `${parent}/`;

			return child === parent || child.startsWith(normalizedParent);
		},
		{
			parse: (value: string) => ({ fsPath: value, root: '/' }),
		} as unknown as typeof import('vscode-uri').URI,
		{
			find: async () => '/',
		} as unknown as PackageRootService,
		(value: string | undefined) => value ?? undefined,
	);
};

const createLoggingService = (logger?: winston.Logger): LoggingService => ({
	createLogger: () => logger ?? createTestLogger(),
});

const createRunner = (
	logger?: winston.Logger,
	workspaceOverrides?: Partial<WorkspaceStylelintService>,
	dependencyOverrides: RunnerDependencyOverrides = {},
	optionsBuilder: StylelintOptionsService = createTestOptionsBuilder(),
) => {
	const workspaceService = createWorkspaceService(workspaceOverrides);
	const workspaceFolderService = (dependencyOverrides.workspaceFolderService ?? {
		getWorkspaceFolder: (connection: Connection, document: TextDocument) =>
			getWorkspaceFolderMock(connection, document),
	}) as WorkspaceFolderService;
	const loggingService = dependencyOverrides.loggingService ?? createLoggingService(logger);

	return new StylelintRunnerService(
		dependencyOverrides.os ?? createOsMock(),
		dependencyOverrides.path ?? (path.posix as unknown as typeof path),
		dependencyOverrides.uri ?? createUriMock(),
		dependencyOverrides.connection ?? mockConnection,
		loggingService,
		workspaceService,
		workspaceFolderService,
		optionsBuilder,
	);
};

const createLintResult = (
	warnings: stylelint.Warning[] = [],
	ruleMetadata?: stylelint.LinterResult['ruleMetadata'],
): LinterResult => ({
	results: [
		{
			warnings,
			invalidOptionWarnings: [],
			ignored: false,
		},
	],
	ruleMetadata,
});

const createMockDocument = (code: string, uri = '/path/to/file.css'): TextDocument =>
	({
		getText: () => code,
		uri,
	}) as TextDocument;

describe('StylelintRunner', () => {
	beforeEach(() => {
		getWorkspaceFolderMock = vi.fn<WorkspaceFolderServiceStub['getWorkspaceFolder']>();
	});

	test('should return no diagnostics if Stylelint cannot be resolved', async () => {
		const workspaceOverrides = {
			lint: vi.fn(async () => undefined),
		};

		const results = await createRunner(undefined, workspaceOverrides).lintDocument(
			createMockDocument(''),
		);

		expect(workspaceOverrides.lint).toHaveBeenCalled();
		expect(results).toEqual({ diagnostics: [] });
	});

	test('should skip diagnostics when worker is temporarily unavailable without notification', async () => {
		const unavailableError = new StylelintWorkerUnavailableError({
			workspaceFolder: '/workspace',
			packageRoot: '/workspace',
			retryInMs: 5_000,
			notifyUser: false,
		});
		const workspaceOverrides = {
			lint: vi.fn(async () => {
				throw unavailableError;
			}),
		};

		getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');

		const results = await createRunner(undefined, workspaceOverrides).lintDocument(
			createMockDocument(''),
		);

		expect(workspaceOverrides.lint).toHaveBeenCalled();
		expect(results).toEqual({ diagnostics: [] });
	});

	test('should rethrow worker unavailability errors when user notification is required', async () => {
		const unavailableError = new StylelintWorkerUnavailableError({
			workspaceFolder: '/workspace',
			packageRoot: '/workspace',
			retryInMs: 5_000,
			notifyUser: true,
		});
		const workspaceOverrides = {
			lint: vi.fn(async () => {
				throw unavailableError;
			}),
		};

		getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');

		await expect(
			createRunner(undefined, workspaceOverrides).lintDocument(createMockDocument('')),
		).rejects.toBe(unavailableError);
	});

	// TODO: Remove once fixed upstream
	test('should upper-case drive letters on Windows (Stylelint bug #5594)', async () => {
		expect.assertions(2);

		const workerResult = {
			resolvedPath: '/workspace/node_modules/stylelint',
			linterResult: createLintResult(),
		};

		const winWorkspace = {
			lint: vi.fn(async ({ options }: Parameters<WorkspaceStylelintService['lint']>[0]) => {
				expect(options.codeFilename).toBe('C:\\path\\to\\file.css');

				return workerResult;
			}),
		};

		await createRunner(undefined, winWorkspace, {
			os: createOsMock('win32'),
			path: path.win32 as unknown as typeof path,
		}).lintDocument(createMockDocument('', 'c:\\path\\to\\file.css'));

		const posixWorkspace = {
			lint: vi.fn(async ({ options }: Parameters<WorkspaceStylelintService['lint']>[0]) => {
				expect(options.codeFilename).toBe('c:/path/to/file.css');

				return workerResult;
			}),
		};

		await createRunner(undefined, posixWorkspace).lintDocument(
			createMockDocument('', 'c:/path/to/file.css'),
		);
	});

	test('should use workspace worker results when available', async () => {
		const warning: stylelint.Warning = {
			line: 1,
			column: 1,
			endLine: 1,
			endColumn: 2,
			rule: 'block-no-empty',
			severity: 'error',
			text: 'Unexpected empty block (block-no-empty)',
		};
		const workspaceOverrides = {
			lint: vi.fn(async () => ({
				resolvedPath: '/workspace/node_modules/stylelint',
				linterResult: createLintResult([warning]),
			})),
		};

		getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');

		const results = await createRunner(undefined, workspaceOverrides).lintDocument(
			createMockDocument('a {}'),
		);

		expect(workspaceOverrides.lint).toHaveBeenCalled();
		expect(snapshotLintDiagnostics(results)).toMatchSnapshot();
	});

	test('should call stylelint.lint with the document path and given options', async () => {
		expect.assertions(1);

		const workspaceOverrides = {
			lint: vi.fn(async ({ options }: Parameters<WorkspaceStylelintService['lint']>[0]) => {
				expect(options).toMatchSnapshot();

				return {
					resolvedPath: '/workspace/node_modules/stylelint',
					linterResult: createLintResult(),
				};
			}),
		};

		await createRunner(undefined, workspaceOverrides).lintDocument(
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

		getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
		const workspaceOverrides = {
			lint: vi.fn(async ({ options }: Parameters<WorkspaceStylelintService['lint']>[0]) => {
				expect(options.config).toEqual({
					rules: {},
				});

				return {
					resolvedPath: '/workspace/node_modules/stylelint',
					linterResult: createLintResult(),
				};
			}),
		};

		await createRunner(undefined, workspaceOverrides).lintDocument(createMockDocument('a {}', ''));
	});

	test("should not change set rules if the document's path cannot be determined", async () => {
		expect.assertions(1);

		getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
		const workspaceOverrides = {
			lint: vi.fn(async ({ options }: Parameters<WorkspaceStylelintService['lint']>[0]) => {
				expect(options.config).toEqual({
					rules: { 'no-empty-source': true },
				});

				return {
					resolvedPath: '/workspace/node_modules/stylelint',
					linterResult: createLintResult(),
				};
			}),
		};

		await createRunner(undefined, workspaceOverrides).lintDocument(createMockDocument('a {}', ''), {
			config: { rules: { 'no-empty-source': true } },
		});
	});

	test('should forward runner options to the workspace service', async () => {
		expect.assertions(3);

		getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
		const workerResult = {
			resolvedPath: '/workspace/node_modules/stylelint',
			linterResult: createLintResult(),
		};
		const workspaceOverrides = {
			lint: vi.fn(async (request: Parameters<WorkspaceStylelintService['lint']>[0]) => {
				expect(request.runnerOptions).toEqual({ packageManager: 'pnpm' });
				expect(request.workspaceFolder).toBe('/workspace');

				return workerResult;
			}),
		};

		await createRunner(undefined, workspaceOverrides).lintDocument(
			createMockDocument('a {}', '/path/to/file.css'),
			undefined,
			{ packageManager: 'pnpm' },
		);

		expect(workspaceOverrides.lint).toHaveBeenCalledTimes(1);
	});

	test('with stylelintPath, should forward the resolved path to the workspace service', async () => {
		expect.assertions(1);

		getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
		const workerResult = {
			resolvedPath: '/workspace/node_modules/stylelint',
			linterResult: createLintResult(),
		};
		const workspaceOverrides = {
			lint: vi.fn(async ({ stylelintPath }: Parameters<WorkspaceStylelintService['lint']>[0]) => {
				expect(stylelintPath).toBe('/workspace/node_modules/stylelint');

				return workerResult;
			}),
		};

		await createRunner(undefined, workspaceOverrides).lintDocument(
			createMockDocument('a {}', '/workspace/path/to/file.css'),
			undefined,
			{ stylelintPath: './node_modules/stylelint' },
		);
	});

	test('should return processed lint results from Stylelint without configured rules', async () => {
		expect.assertions(1);

		const cssSyntaxErrorWarning: stylelint.Warning = {
			line: 1,
			column: 1,
			endLine: 1,
			endColumn: 2,
			rule: 'CssSyntaxError',
			severity: 'error',
			text: 'Unclosed block (CssSyntaxError)',
		};

		getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
		const workspaceOverrides = {
			lint: vi.fn(async () => ({
				resolvedPath: '/workspace/node_modules/stylelint',
				linterResult: createLintResult([cssSyntaxErrorWarning]),
			})),
		};
		const results = await createRunner(undefined, workspaceOverrides).lintDocument(
			createMockDocument('table {', '/path/to/file.css'),
		);

		expect(snapshotLintDiagnostics(results)).toMatchSnapshot();
	});

	test('should return processed lint results from Stylelint with configured rules', async () => {
		expect.assertions(1);

		const blockWarning: stylelint.Warning = {
			line: 1,
			column: 3,
			endLine: 1,
			endColumn: 5,
			rule: 'block-no-empty',
			severity: 'error',
			text: 'Unexpected empty block (block-no-empty)',
		};
		const ruleMetadata = {
			'block-no-empty': {
				url: 'https://stylelint.io/user-guide/rules/block-no-empty',
			},
		};

		getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
		const workspaceOverrides = {
			lint: vi.fn(async () => ({
				resolvedPath: '/workspace/node_modules/stylelint',
				linterResult: createLintResult([blockWarning], ruleMetadata),
				ruleMetadata,
			})),
		};
		const results = await createRunner(undefined, workspaceOverrides).lintDocument(
			createMockDocument('a {}', '/path/to/file.css'),
			{ config: { rules: { 'block-no-empty': true } } },
		);

		expect(snapshotLintDiagnostics(results)).toMatchSnapshot();
	});

	test('should throw errors thrown by Stylelint', async () => {
		expect.assertions(1);

		const workspaceOverrides = {
			lint: vi.fn(async ({ options }: Parameters<WorkspaceStylelintService['lint']>[0]) => {
				if (options.files) {
					throw new Error(
						'You must pass stylelint a `files` glob or a `code` string, though not both',
					);
				}

				return {
					resolvedPath: '/workspace/node_modules/stylelint',
					linterResult: createLintResult(),
				};
			}),
		};

		await expect(
			createRunner(undefined, workspaceOverrides).lintDocument(
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

		const mockLogger = createTestLogger();

		const workspaceOverrides = {
			lint: vi.fn(async () => ({
				resolvedPath: '/workspace/node_modules/stylelint',
				linterResult: createLintResult(),
			})),
		};

		getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');

		await createRunner(mockLogger, workspaceOverrides).lintDocument(
			createMockDocument('a {}', '/path/to/file.css'),
			{ config: { rules: { 'block-no-empty': true } } },
		);

		expect(mockLogger.debug).toHaveBeenCalledTimes(1);
		expect(mockLogger.debug).toHaveBeenCalledWith(
			expect.stringMatching(/^Running Stylelint/),
			expect.any(Object),
		);
	});

	if (semver.satisfies(stylelintVersion, '>=16.15')) {
		it('should be possible to get the original warning via getWarning', async () => {
			expect.assertions(1);

			const warning: stylelint.Warning = {
				line: 1,
				column: 10,
				endLine: 1,
				endColumn: 14,
				rule: 'color-hex-length',
				severity: 'error',
				text: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
				fix: {
					range: [12, 13],
					text: 'ffff',
				},
			};

			getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
			const workspaceOverrides = {
				lint: vi.fn(async () => ({
					resolvedPath: '/workspace/node_modules/stylelint',
					linterResult: createLintResult([warning]),
				})),
			};
			const results = await createRunner(undefined, workspaceOverrides).lintDocument(
				createMockDocument('a {color:#fff}', '/path/to/file.css'),
				{ config: { rules: { 'color-hex-length': 'long' } } },
			);

			expect(results.getWarning?.(results.diagnostics[0])).toEqual(warning);
		});
	}

	it('should not get the warning with getWarning and a non-existent diagnostic', async () => {
		expect.assertions(1);

		const warning: stylelint.Warning = {
			line: 1,
			column: 10,
			endLine: 1,
			endColumn: 14,
			rule: 'color-hex-length',
			severity: 'error',
			text: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
		};

		getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
		const workspaceOverrides = {
			lint: vi.fn(async () => ({
				resolvedPath: '/workspace/node_modules/stylelint',
				linterResult: createLintResult([warning]),
			})),
		};
		const results = await createRunner(undefined, workspaceOverrides).lintDocument(
			createMockDocument('a {color:#fff}', '/path/to/file.css'),
			{ config: { rules: { 'color-hex-length': 'long' } } },
		);

		expect(
			results.getWarning?.({
				message: 'Message for rule 1',
				source: 'Stylelint',
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
				code: 'rule 1',
				severity: LSP.DiagnosticSeverity.Error,
				codeDescription: {
					href: 'https://stylelint.io/user-guide/rules/rule',
				},
			}),
		).toBeNull();
	});

	test('should throw non-Error objects as-is', async () => {
		expect.assertions(1);

		const workspaceOverrides = {
			lint: vi.fn(async () => {
				// Throw a non-error object to test error handling.
				// eslint-disable-next-line @typescript-eslint/only-throw-error
				throw 'This is not an Error object';
			}),
		};

		await expect(
			createRunner(undefined, workspaceOverrides).lintDocument(createMockDocument('a {}')),
		).rejects.toBe('This is not an Error object');
	});

	test('should handle "No rules found within configuration" error by adding configuration diagnostic', async () => {
		expect.assertions(2);

		const workspaceOverrides = {
			lint: vi.fn(async ({ options }: Parameters<WorkspaceStylelintService['lint']>[0]) => {
				if (options.config?.rules && Object.keys(options.config.rules).length === 0) {
					return {
						resolvedPath: '/workspace/node_modules/stylelint',
						linterResult: createLintResult(),
					};
				}

				throw new Error(
					'No rules found within configuration. Have you provided a "rules" property?',
				);
			}),
		};
		const results = await createRunner(undefined, workspaceOverrides).lintDocument(
			createMockDocument('a {}'),
			{
				config: {},
			},
		);

		expect(results.diagnostics).toEqual([
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 0 },
				},
				message: 'No rules found within configuration. Have you provided a "rules" property?',
				severity: 1,
				source: 'Stylelint',
				code: 'no-rules-configured',
			},
		]);
		expect(results.getWarning).toEqual(expect.any(Function));
	});

	test('should combine syntax errors with configuration error when no rules are defined', async () => {
		expect.assertions(2);

		const workspaceOverrides = {
			lint: vi.fn(async ({ options }: Parameters<WorkspaceStylelintService['lint']>[0]) => {
				if (options.config?.rules && Object.keys(options.config.rules).length === 0) {
					return {
						resolvedPath: '/workspace/node_modules/stylelint',
						linterResult: createLintResult([
							{
								line: 1,
								column: 3,
								endLine: 1,
								endColumn: 3,
								rule: 'CssSyntaxError',
								severity: 'error',
								text: 'Unclosed block (CssSyntaxError)',
							},
						]),
					};
				}

				throw new Error(
					'No rules found within configuration. Have you provided a "rules" property?',
				);
			}),
		};
		const results = await createRunner(undefined, workspaceOverrides).lintDocument(
			createMockDocument('a {'),
			{
				config: {},
			},
		);

		// Should have both syntax error and configuration error.
		expect(results.diagnostics).toHaveLength(2);
		expect(results.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'no-rules-configured',
					message: 'No rules found within configuration. Have you provided a "rules" property?',
				}),
				expect.objectContaining({
					code: 'CssSyntaxError',
					message: 'Unclosed block (CssSyntaxError)',
				}),
			]),
		);
	});

	describe('resolve', () => {
		test('should skip resolve errors when worker unavailability does not require notification', async () => {
			const unavailableError = new StylelintWorkerUnavailableError({
				workspaceFolder: '/workspace',
				packageRoot: '/workspace',
				retryInMs: 5_000,
				notifyUser: false,
			});
			const workspaceOverrides = {
				resolve: vi.fn(async () => {
					throw unavailableError;
				}),
			};

			getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
			const runner = createRunner(undefined, workspaceOverrides);
			const document = createMockDocument('', '/workspace/file.css');

			await expect(runner.resolve(document)).resolves.toBeUndefined();
		});

		test('should resolve Stylelint via the workspace service', async () => {
			getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
			const workspaceOverrides = {
				resolve: vi.fn(async () => ({
					...defaultResolution,
					version: '16.0.0',
				})),
			};
			const runner = createRunner(undefined, workspaceOverrides);
			const document = createMockDocument('', '/workspace/file.css');

			const result = await runner.resolve(document);

			expect(workspaceOverrides.resolve).toHaveBeenCalledWith({
				workspaceFolder: '/workspace',
				stylelintPath: undefined,
				codeFilename: '/workspace/file.css',
				runnerOptions: {},
			});
			expect(result).toEqual({
				entryPath: defaultResolution.entryPath,
				resolvedPath: defaultResolution.resolvedPath,
				version: '16.0.0',
			});
		});

		test('should resolve configured Stylelint paths relative to the workspace', async () => {
			getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
			const workspaceOverrides = {
				resolve: vi.fn(async () => ({
					...defaultResolution,
				})),
			};
			const runner = createRunner(undefined, workspaceOverrides);
			const document = createMockDocument('', '/workspace/file.css');

			await runner.resolve(document, { stylelintPath: './custom/stylelint' });

			expect(workspaceOverrides.resolve).toHaveBeenCalledWith({
				workspaceFolder: '/workspace',
				stylelintPath: '/workspace/custom/stylelint',
				codeFilename: '/workspace/file.css',
				runnerOptions: { stylelintPath: './custom/stylelint' },
			});
		});

		test('should return undefined when Stylelint cannot be resolved', async () => {
			getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
			const workspaceOverrides = {
				resolve: vi.fn(async () => {
					throw new StylelintNotFoundError();
				}),
			};
			const runner = createRunner(undefined, workspaceOverrides);
			const document = createMockDocument('', '/workspace/file.css');

			await expect(runner.resolve(document)).resolves.toBeUndefined();
			expect(workspaceOverrides.resolve).toHaveBeenCalled();
		});
	});

	describe('workspace activity hooks', () => {
		test('handleDocumentOpened should notify the workspace service', async () => {
			getWorkspaceFolderMock.mockResolvedValueOnce('/workspace');
			const notifyWorkspaceActivity = vi.fn();
			const runner = createRunner(undefined, { notifyWorkspaceActivity });
			const document = createMockDocument('', '/workspace/file.css');

			await runner.handleDocumentOpened(document);

			expect(notifyWorkspaceActivity).toHaveBeenCalledWith('/workspace');
		});

		test('handleWatchedFilesChanged should forward file paths to the workspace service', () => {
			const notifyFileActivity = vi.fn();
			const runner = createRunner(undefined, { notifyFileActivity });

			runner.handleWatchedFilesChanged([{ uri: '/workspace/changed.css', type: 1 } as FileEvent]);

			expect(notifyFileActivity).toHaveBeenCalledWith('/workspace/changed.css');
		});
	});
});
