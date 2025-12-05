import { TextDocument } from 'vscode-languageserver-textdocument';
import type { StylelintRunnerService } from '../../../src/server/services/index.js';
import type {
	LintDiagnostics,
	StylelintResolutionResult,
} from '../../../src/server/stylelint/index.js';
import type { RunnerOptions } from '../../../src/server/stylelint/types.js';

export type StylelintRunnerStub = Pick<StylelintRunnerService, 'lintDocument' | 'resolve'> & {
	lintCalls: Array<{
		document: TextDocument;
		linterOptions?: unknown;
		runnerOptions?: RunnerOptions;
	}>;
	resolveCalls: string[];
	setLintResult(uri: string, result: LintDiagnostics | undefined): void;
	setLintError(uri: string, error: unknown): void;
	setResolution(uri: string, result: StylelintResolutionResult | undefined): void;
};

export function createStylelintRunnerStub(): StylelintRunnerStub {
	const lintResults = new Map<string, LintDiagnostics | undefined>();
	const lintErrors = new Map<string, unknown>();
	const resolutions = new Map<string, StylelintResolutionResult | undefined>();
	const lintCalls: StylelintRunnerStub['lintCalls'] = [];
	const resolveCalls: string[] = [];

	return {
		lintCalls,
		resolveCalls,
		setLintResult: (uri: string, result: LintDiagnostics | undefined) => {
			lintResults.set(uri, result);
		},
		setLintError: (uri: string, error: unknown) => {
			lintErrors.set(uri, error);
		},
		setResolution: (uri: string, result: StylelintResolutionResult | undefined) => {
			resolutions.set(uri, result);
		},
		async lintDocument(
			document: TextDocument,
			linterOptions?: unknown,
			runnerOptions?: RunnerOptions,
		) {
			lintCalls.push({ document, linterOptions, runnerOptions });

			if (lintErrors.has(document.uri)) {
				const error = lintErrors.get(document.uri);

				if (error instanceof Error) {
					throw error;
				}

				throw new Error(String(error));
			}

			return lintResults.get(document.uri) as unknown as LintDiagnostics;
		},
		async resolve(document: TextDocument) {
			resolveCalls.push(document.uri);

			return resolutions.get(document.uri);
		},
	};
}
