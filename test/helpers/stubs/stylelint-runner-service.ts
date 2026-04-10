import { TextDocument } from 'vscode-languageserver-textdocument';
import type { StylelintRunnerService } from '../../../packages/language-server/src/server/services/index.js';
import type {
	LintDiagnostics,
	MultiFileLintDiagnostics,
	StylelintResolutionResult,
} from '../../../packages/language-server/src/server/stylelint/index.js';
import type { RunnerOptions } from '../../../packages/language-server/src/server/stylelint/types.js';

export type StylelintRunnerStub = Pick<
	StylelintRunnerService,
	'lintDocument' | 'resolve' | 'lintWorkspaceFolder'
> & {
	lintCalls: Array<{
		document: TextDocument;
		linterOptions?: unknown;
		runnerOptions?: RunnerOptions;
		signal?: AbortSignal;
	}>;
	resolveCalls: string[];
	lintWorkspaceFolderCalls: Array<{
		workspaceFolder: string;
		runnerOptions?: RunnerOptions;
	}>;
	setLintResult(uri: string, result: LintDiagnostics | undefined): void;
	setLintError(uri: string, error: unknown): void;
	setResolution(uri: string, result: StylelintResolutionResult | undefined): void;
	setLintWorkspaceFolderResult(result: MultiFileLintDiagnostics): void;
	setLintWorkspaceFolderError(error: unknown): void;
	/**
	 * Makes lintDocument return a promise that won't resolve until the returned
	 * callback is invoked.
	 */
	setDeferredLintResult(uri: string, result: LintDiagnostics | undefined): () => void;
};

export function createStylelintRunnerStub(): StylelintRunnerStub {
	const lintResults = new Map<string, LintDiagnostics | undefined>();
	const lintErrors = new Map<string, unknown>();
	const deferredResolvers = new Map<string, () => void>();
	const deferredResults = new Map<string, LintDiagnostics | undefined>();
	const resolutions = new Map<string, StylelintResolutionResult | undefined>();
	const lintCalls: StylelintRunnerStub['lintCalls'] = [];
	const resolveCalls: string[] = [];
	const lintWorkspaceFolderCalls: StylelintRunnerStub['lintWorkspaceFolderCalls'] = [];
	let workspaceFolderResult: MultiFileLintDiagnostics = new Map();
	let workspaceFolderError: unknown;

	return {
		lintCalls,
		resolveCalls,
		lintWorkspaceFolderCalls,
		setLintResult: (uri: string, result: LintDiagnostics | undefined) => {
			lintResults.set(uri, result);
		},
		setLintError: (uri: string, error: unknown) => {
			lintErrors.set(uri, error);
		},
		setResolution: (uri: string, result: StylelintResolutionResult | undefined) => {
			resolutions.set(uri, result);
		},
		setLintWorkspaceFolderResult: (result: MultiFileLintDiagnostics) => {
			workspaceFolderResult = result;
		},
		setLintWorkspaceFolderError: (error: unknown) => {
			workspaceFolderError = error;
		},
		setDeferredLintResult: (uri: string, result: LintDiagnostics | undefined): (() => void) => {
			deferredResolvers.set(uri, () => {});
			deferredResults.set(uri, result);

			// Return callback that releases the lint.
			return () => {
				const r = deferredResolvers.get(uri);

				if (r) {
					deferredResolvers.delete(uri);
					deferredResults.delete(uri);
					r();
				}
			};
		},
		async lintDocument(
			document: TextDocument,
			linterOptions?: unknown,
			runnerOptions?: RunnerOptions,
			signal?: AbortSignal,
		) {
			lintCalls.push({ document, linterOptions, runnerOptions, signal });

			if (lintErrors.has(document.uri)) {
				const error = lintErrors.get(document.uri);

				if (error instanceof Error) {
					throw error;
				}

				throw new Error(String(error));
			}

			// If a deferred result is registered, wait for it to be released.
			if (deferredResolvers.has(document.uri)) {
				await new Promise<void>((resolve) => {
					const existingResolve = deferredResolvers.get(document.uri)!;

					deferredResolvers.set(document.uri, () => {
						existingResolve();
						resolve();
					});
				});

				return deferredResults.get(document.uri) as unknown as LintDiagnostics;
			}

			return lintResults.get(document.uri) as unknown as LintDiagnostics;
		},
		async resolve(document: TextDocument) {
			resolveCalls.push(document.uri);

			return resolutions.get(document.uri);
		},
		async lintWorkspaceFolder(workspaceFolder: string, runnerOptions?: RunnerOptions) {
			lintWorkspaceFolderCalls.push({ workspaceFolder, runnerOptions });

			if (workspaceFolderError) {
				if (workspaceFolderError instanceof Error) {
					throw workspaceFolderError;
				}

				throw new Error('Unknown workspace folder lint error');
			}

			return workspaceFolderResult;
		},
	};
}
