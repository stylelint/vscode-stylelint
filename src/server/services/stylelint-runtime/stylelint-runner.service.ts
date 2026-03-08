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
import {
	processLinterResult,
	processMultiFileLinterResult,
} from '../../stylelint/process-linter-result.js';
import {
	createRuleMetadataSourceFromSnapshot,
	type LintDiagnostics,
	type MultiFileLintDiagnostics,
	type RunnerOptions,
	type StylelintResolutionResult,
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
import { PackageRootService } from './package-root.service.js';
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
		PackageRootService,
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
	#packageRootFinder: PackageRootService;
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
		packageRootFinder: PackageRootService,
	) {
		this.#os = osModule;
		this.#path = pathModule;
		this.#uri = uriModule;
		this.#connection = connection;
		this.#logger = loggingService.createLogger(StylelintRunnerService);
		this.#workspaceService = workspaceService;
		this.#workspaceFolderService = workspaceFolderService;
		this.#optionsBuilder = optionsBuilder;
		this.#packageRootFinder = packageRootFinder;
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
		const resolvedStylelintPath = this.#resolveConfiguredStylelintPath(
			runnerOptions.stylelintPath,
			workspaceFolder ?? this.#getDocumentFolder(document),
		);
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

	/**
	 * Lint all files in a workspace folder.
	 * @param workspaceFolder Absolute path to the workspace folder.
	 * @param runnerOptions Extension options derived from settings.
	 */
	async lintWorkspaceFolder(
		workspaceFolder: string,
		runnerOptions: RunnerOptions = {},
	): Promise<MultiFileLintDiagnostics> {
		const subPackages = await this.#packageRootFinder.findSubPackages(workspaceFolder);

		if (subPackages.length === 0) {
			return this.#lintSingleRoot(workspaceFolder, workspaceFolder, runnerOptions);
		}

		this.#logger?.info('Found sub-packages in workspace folder', {
			workspaceFolder,
			subPackages,
		});

		const allDiagnostics: MultiFileLintDiagnostics = new Map();

		// Lint each sub-package with its own cwd so that per-package
		// .stylelintignore and configs are resolved correctly.
		const subPackageLints = subPackages.map((pkg) =>
			this.#lintSingleRoot(pkg, workspaceFolder, runnerOptions),
		);

		// Also lint files directly under the workspace root that are not
		// inside any sub-package.
		const exclusions = subPackages.map((pkg) => {
			const relative = this.#path.relative(workspaceFolder, pkg).split(this.#path.sep).join('/');

			return `!${relative}/**`;
		});

		const rootLint = this.#lintSingleRoot(
			workspaceFolder,
			workspaceFolder,
			runnerOptions,
			exclusions,
		);

		const results = await Promise.all([...subPackageLints, rootLint]);

		for (const result of results) {
			for (const [filePath, diagnostics] of result) {
				allDiagnostics.set(filePath, diagnostics);
			}
		}

		return allDiagnostics;
	}

	async #lintSingleRoot(
		cwd: string,
		workspaceFolder: string,
		runnerOptions: RunnerOptions,
		extraGlobs: string[] = [],
	): Promise<MultiFileLintDiagnostics> {
		const stylelintPath = this.#resolveConfiguredStylelintPath(
			runnerOptions.stylelintPath,
			workspaceFolder,
		);
		const baseGlob = runnerOptions.lintFilesGlob || '**/*.css';
		const options = await this.#createBaseOptions(
			this.#uri.file(cwd).toString(),
			workspaceFolder,
			runnerOptions,
			{
				files: [baseGlob, ...extraGlobs],
				cwd,
				allowEmptyInput: true,
			},
		);

		this.#logger?.info('Linting folder', { cwd, workspaceFolder });

		try {
			const result = await this.#workspaceService.lint({
				workspaceFolder: cwd,
				options,
				stylelintPath,
				runnerOptions,
			});

			if (!result) {
				this.#logger?.info('No Stylelint found for folder', { cwd });

				return new Map();
			}

			return processMultiFileLinterResult(
				createRuleMetadataSourceFromSnapshot(result.ruleMetadata),
				result.linterResult,
				this.#logger,
				runnerOptions.rules?.customizations,
			);
		} catch (error) {
			return this.#handleLintError<MultiFileLintDiagnostics>(error, cwd, new Map());
		}
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

		const stylelintPath = this.#resolveConfiguredStylelintPath(
			runnerOptions.stylelintPath,
			fallbackFolder,
		);

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
			return this.#handleLintError(error, fallbackFolder, undefined);
		}
	}

	async resolveConfig(
		document: TextDocument,
		runnerOptions: RunnerOptions = {},
	): Promise<stylelint.Config | undefined> {
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

		const stylelintPath = this.#resolveConfiguredStylelintPath(
			runnerOptions.stylelintPath,
			fallbackFolder,
		);

		const fsPath = this.#uri.parse(document.uri).fsPath;

		if (!fsPath) {
			return undefined;
		}

		try {
			const result = await this.#workspaceService.resolveConfig({
				workspaceFolder: fallbackFolder,
				filePath: fsPath,
				stylelintPath,
				runnerOptions,
			});

			return result?.config;
		} catch (error) {
			return this.#handleLintError(error, fallbackFolder, undefined);
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

	#resolveConfiguredStylelintPath(
		stylelintPath: string | undefined,
		baseFolder?: string,
	): string | undefined {
		if (!stylelintPath) {
			return undefined;
		}

		const pathModule = this.#path;

		if (pathModule.isAbsolute(stylelintPath)) {
			return stylelintPath;
		}

		if (baseFolder) {
			return pathModule.join(baseFolder, stylelintPath);
		}

		return pathModule.resolve(stylelintPath);
	}

	async #createBaseOptions(
		resourceUri: string,
		workspaceFolder: string | undefined,
		runnerOptions: RunnerOptions,
		linterOptions: stylelint.LinterOptions = {},
		overrides: Partial<stylelint.LinterOptions> = {},
	): Promise<stylelint.LinterOptions> {
		const baseOptions = await this.#optionsBuilder.build(
			resourceUri,
			workspaceFolder,
			linterOptions,
			runnerOptions,
		);

		const options: stylelint.LinterOptions = {
			...baseOptions,
			...overrides,
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore -- (TS2353) `computeEditInfo` option is available since v16.15.
			computeEditInfo: true,
		};

		if (options.formatter === undefined) {
			options.formatter = noopFormatter;
		}

		return options;
	}

	#handleLintError<T>(error: unknown, workspaceFolder: string, fallback: T): T {
		if (error instanceof StylelintNotFoundError) {
			return fallback;
		}

		if (error instanceof StylelintWorkerUnavailableError) {
			this.#handleWorkerUnavailable(error, workspaceFolder);

			if (error.notifyUser) {
				throw error;
			}

			return fallback;
		}

		throw error;
	}

	async #createLinterOptions(
		document: TextDocument,
		workspaceFolder: string | undefined,
		linterOptions: stylelint.LinterOptions,
		runnerOptions: RunnerOptions,
	): Promise<stylelint.LinterOptions> {
		const options = await this.#createBaseOptions(
			document.uri,
			workspaceFolder,
			runnerOptions,
			linterOptions,
			{ code: document.getText() },
		);

		const codeFilename = this.#getCodeFilename(this.#uri.parse(document.uri).fsPath);

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
			return this.#handleLintError(error, lintWorkspaceFolder, undefined);
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
