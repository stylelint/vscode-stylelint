import os from 'os';
import path from 'path';
import type stylelint from 'stylelint';
import type { Connection } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticSeverity, Position, Range } from 'vscode-languageserver-types';
import { URI } from 'vscode-uri';
import type winston from 'winston';

import { inject } from '../../../di/index.js';
import { processLinterResult } from '../../stylelint/process-linter-result.js';
import type { StylelintResolutionResult } from '../../stylelint/types.js';
import {
	createRuleMetadataSourceFromSnapshot,
	type LintDiagnostics,
	type RunnerOptions,
} from '../../stylelint/types.js';
import {
	lspConnectionToken,
	OsModuleToken,
	PathModuleToken,
	UriModuleToken,
} from '../../tokens.js';
import {
	StylelintNotFoundError,
	StylelintWorkerUnavailableError,
} from '../../worker/worker-process.js';
import { LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';
import { StylelintOptionsService } from './stylelint-options.service.js';
import { WorkspaceFolderService } from '../workspace/workspace-folder.service.js';
import { WorkspaceStylelintService } from './workspace-stylelint.service.js';

const noopFormatter = (() => '') as unknown as stylelint.LinterOptions['formatter'];

/**
 * Runs Stylelint in VS Code.
 */
@inject({
	inject: [
		OsModuleToken,
		PathModuleToken,
		UriModuleToken,
		lspConnectionToken,
		loggingServiceToken,
		WorkspaceStylelintService,
		WorkspaceFolderService,
		StylelintOptionsService,
	],
})
export class StylelintRunnerService {
	/**
	 * The language server connection.
	 */
	#connection: Connection;

	/**
	 * The logger to use.
	 */
	#logger: winston.Logger;

	/**
	 * Workspace worker service.
	 */
	#workspaceService: WorkspaceStylelintService;

	#workspaceFolderService: WorkspaceFolderService;

	#optionsBuilder: StylelintOptionsService;
	readonly #os: typeof os;
	readonly #path: typeof path;
	readonly #uri: typeof URI;

	constructor(
		osModule: typeof os,
		pathModule: typeof path,
		uriModule: typeof URI,
		connection: Connection,
		loggingService: LoggingService,
		workspaceService: WorkspaceStylelintService,
		workspaceFolderService: WorkspaceFolderService,
		optionsBuilder: StylelintOptionsService,
	) {
		this.#os = osModule;
		this.#path = pathModule;
		this.#uri = uriModule;
		this.#connection = connection;
		this.#logger = loggingService.createLogger(StylelintRunnerService);
		this.#workspaceService = workspaceService;
		this.#workspaceFolderService = workspaceFolderService;
		this.#optionsBuilder = optionsBuilder;
	}

	/**
	 * Lints the given document using Stylelint. The linting result is then
	 * converted to LSP diagnostics and returned.
	 * @param document
	 * @param linterOptions
	 * @param extensionOptions
	 */
	async lintDocument(
		document: TextDocument,
		linterOptions: stylelint.LinterOptions = {},
		runnerOptions: RunnerOptions = {},
	): Promise<LintDiagnostics> {
		const workspaceFolder = await this.#workspaceFolderService.getWorkspaceFolder(
			this.#connection,
			document,
		);
		const resolvedStylelintPath = runnerOptions.stylelintPath
			? this.#resolveConfiguredStylelintPath(
					runnerOptions.stylelintPath,
					workspaceFolder ?? this.#getDocumentFolder(document),
				)
			: undefined;
		const options = await this.#createLinterOptions(
			document,
			workspaceFolder,
			linterOptions,
			runnerOptions,
		);

		const diagnostics = await this.#lintWithWorkspaceService(
			document,
			workspaceFolder,
			options,
			runnerOptions,
			resolvedStylelintPath,
		);

		if (diagnostics) {
			return diagnostics;
		}

		this.#logger?.info('No Stylelint found with which to lint document', {
			uri: document.uri,
			options: runnerOptions,
		});

		return { diagnostics: [] };
	}

	async resolve(
		document: TextDocument,
		runnerOptions: RunnerOptions = {},
	): Promise<StylelintResolutionResult | undefined> {
		if (!this.#workspaceService) {
			return undefined;
		}

		const workspaceFolder = await this.#workspaceFolderService.getWorkspaceFolder(
			this.#connection,
			document,
		);
		const fallbackFolder = workspaceFolder ?? this.#getDocumentFolder(document);

		if (!fallbackFolder) {
			return undefined;
		}

		const stylelintPath = runnerOptions.stylelintPath
			? this.#resolveConfiguredStylelintPath(runnerOptions.stylelintPath, fallbackFolder)
			: undefined;

		try {
			const result = await this.#workspaceService.resolve({
				workspaceFolder: fallbackFolder,
				stylelintPath,
				codeFilename: this.#uri.parse(document.uri).fsPath,
				runnerOptions,
			});

			return result
				? {
						entryPath: result.entryPath,
						resolvedPath: result.resolvedPath,
						version: result.version,
					}
				: undefined;
		} catch (error) {
			if (error instanceof StylelintNotFoundError) {
				return undefined;
			}

			if (error instanceof StylelintWorkerUnavailableError) {
				this.#handleWorkerUnavailable(error, fallbackFolder);

				if (error.notifyUser) {
					throw error;
				}

				return undefined;
			}

			throw error;
		}
	}

	async handleDocumentOpened(document: TextDocument): Promise<void> {
		if (!this.#workspaceService) {
			return;
		}

		const workspaceFolder = await this.#workspaceFolderService.getWorkspaceFolder(
			this.#connection,
			document,
		);
		const fallbackFolder = workspaceFolder ?? this.#getDocumentFolder(document);

		if (!fallbackFolder) {
			return;
		}

		this.#logger?.debug('Document opened, notifying workspace activity', {
			workspaceFolder: fallbackFolder,
		});
		this.#workspaceService.notifyWorkspaceActivity(fallbackFolder);
	}

	notifyWorkspaceActivity(workspaceFolder: string): void {
		this.#workspaceService?.notifyWorkspaceActivity(workspaceFolder);
	}

	handleWatchedFilesChanged(changes: LSP.FileEvent[]): void {
		if (!this.#workspaceService || changes.length === 0) {
			return;
		}

		for (const change of changes) {
			const fsPath = this.#uri.parse(change.uri).fsPath;

			if (fsPath) {
				this.#workspaceService.notifyFileActivity(fsPath);
			}
		}
	}

	#handleWorkerUnavailable(error: StylelintWorkerUnavailableError, workspaceFolder: string): void {
		const retryInSeconds = Math.max(1, Math.ceil(error.retryInMs / 1000));
		const lastErrorMessage =
			error.lastCrashError?.message ?? error.lastCrashError?.originalError?.message;

		this.#logger?.warn('Stylelint worker temporarily unavailable', {
			workspaceFolder,
			packageRoot: error.packageRoot,
			retryInSeconds,
			lastError: lastErrorMessage,
			notifyUser: error.notifyUser,
		});
	}

	#resolveConfiguredStylelintPath(stylelintPath: string, baseFolder?: string): string {
		const pathModule = this.#path;

		if (pathModule.isAbsolute(stylelintPath)) {
			return stylelintPath;
		}

		if (baseFolder) {
			return pathModule.join(baseFolder, stylelintPath);
		}

		return pathModule.resolve(stylelintPath);
	}

	async #createLinterOptions(
		document: TextDocument,
		workspaceFolder: string | undefined,
		linterOptions: stylelint.LinterOptions,
		runnerOptions: RunnerOptions,
	): Promise<stylelint.LinterOptions> {
		const baseOptions = await this.#optionsBuilder.build(
			document.uri,
			workspaceFolder,
			linterOptions,
			runnerOptions,
		);
		const { fsPath } = this.#uri.parse(document.uri);

		const options: stylelint.LinterOptions = {
			...baseOptions,
			code: document.getText(),
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore -- (TS2353) `computeEditInfo` option is available since v16.15.
			computeEditInfo: true,
		};

		if (options.formatter === undefined) {
			options.formatter = noopFormatter;
		}

		const codeFilename = this.#getCodeFilename(fsPath);

		if (codeFilename) {
			options.codeFilename = codeFilename;
		} else if (!linterOptions?.config?.rules) {
			options.config = { rules: {} };
		}

		return options;
	}

	#getCodeFilename(fsPath: string | undefined): string | undefined {
		if (!fsPath) {
			return undefined;
		}

		// Workaround for Stylelint treating paths as case-sensitive on Windows
		// If the drive letter is lowercase, we need to convert it to uppercase
		// See https://github.com/stylelint/stylelint/issues/5594
		// TODO: Remove once fixed upstream
		if (this.#os.platform() === 'win32') {
			return fsPath.replace(/^[a-z]:/, (match) => match.toUpperCase());
		}

		return fsPath;
	}

	#getDocumentFolder(document: TextDocument): string | undefined {
		const { fsPath } = this.#uri.parse(document.uri);

		if (!fsPath) {
			return undefined;
		}

		return this.#path.dirname(fsPath);
	}

	async #lintWithWorkspaceService(
		document: TextDocument,
		workspaceFolder: string | undefined,
		options: stylelint.LinterOptions,
		runnerOptions: RunnerOptions,
		stylelintPath?: string,
	): Promise<LintDiagnostics | undefined> {
		if (!this.#workspaceService) {
			return undefined;
		}

		const lintWorkspaceFolder = workspaceFolder ?? this.#getDocumentFolder(document);

		if (!lintWorkspaceFolder) {
			return undefined;
		}

		let cachedResult: Awaited<ReturnType<WorkspaceStylelintService['lint']>>;
		const convertResult = (result: NonNullable<typeof cachedResult>): LintDiagnostics =>
			processLinterResult(
				createRuleMetadataSourceFromSnapshot(result.ruleMetadata),
				result.linterResult,
				this.#logger,
				runnerOptions.rules?.customizations,
			);
		const runLint = async (lintOptions: stylelint.LinterOptions): Promise<LintDiagnostics> => {
			const result =
				lintOptions === options && cachedResult
					? cachedResult
					: await this.#workspaceService.lint({
							workspaceFolder: lintWorkspaceFolder,
							options: lintOptions,
							stylelintPath,
							runnerOptions,
						});

			if (!result) {
				throw new StylelintNotFoundError();
			}

			if (lintOptions === options) {
				cachedResult = result;

				if (this.#logger?.isDebugEnabled()) {
					this.#logger.debug('Running Stylelint', {
						options: { ...lintOptions, code: '...' },
						workspaceFolder: lintWorkspaceFolder,
					});
				}
			}

			const lintDiagnostics = convertResult(result);
			const hasCssSyntaxErrors =
				result.linterResult.results?.some((lintResult) =>
					lintResult.warnings?.some((warning) => warning.rule === 'CssSyntaxError'),
				) ?? false;

			if (lintOptions.fix && hasCssSyntaxErrors) {
				// Skip edits when syntax parsing fails.
				lintDiagnostics.code = undefined;
				lintDiagnostics.output = undefined;
			}

			return lintDiagnostics;
		};

		try {
			return await this.#runLintWithErrorHandling(runLint, options);
		} catch (error) {
			if (error instanceof StylelintNotFoundError) {
				return undefined;
			}

			if (error instanceof StylelintWorkerUnavailableError) {
				this.#handleWorkerUnavailable(error, lintWorkspaceFolder);

				if (error.notifyUser) {
					throw error;
				}

				return undefined;
			}

			throw error;
		}
	}

	async #runLintWithErrorHandling(
		runLint: (options: stylelint.LinterOptions) => Promise<LintDiagnostics>,
		options: stylelint.LinterOptions,
	): Promise<LintDiagnostics> {
		try {
			return await runLint(options);
		} catch (err) {
			if (!(err instanceof Error)) {
				throw err;
			}

			const lintSyntax = async (): Promise<LintDiagnostics> =>
				await runLint({ ...options, config: { rules: {} } });

			if (err.message.startsWith('No configuration provided for')) {
				// Check only CSS syntax errors without applying any Stylelint rules.
				return await lintSyntax();
			}

			if (err.message.includes('No rules found within configuration')) {
				// Always run syntax-only linting to catch CSS syntax errors.
				const combinedResult = await lintSyntax();

				// Add the configuration error diagnostic to the syntax results.
				combinedResult.diagnostics.push({
					range: Range.create(Position.create(0, 0), Position.create(0, 0)),
					message: err.message,
					severity: DiagnosticSeverity.Error,
					source: 'Stylelint',
					code: 'no-rules-configured',
				});

				return combinedResult;
			}

			throw err;
		}
	}

	disposeWorkspace(workspaceFolder: string): void {
		this.#workspaceService.dispose(workspaceFolder);
	}

	dispose(): void {
		this.#workspaceService.disposeAll();
	}
}
