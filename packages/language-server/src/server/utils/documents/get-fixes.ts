import { createTextEdits } from './create-text-edits.js';
import type stylelint from 'stylelint';
import type { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import type { RunnerOptions } from '../../stylelint/index.js';
import { StylelintRunnerService } from '../../services/stylelint-runtime/stylelint-runner.service.js';

/**
 * Runs Stylelint and returns fix text edits for the given document.
 * @param runner The Stylelint runner.
 * @param document The document to get fixes for.
 * @param linterOptions Linter options to use.
 * @param runnerOptions The runner options.
 */
export async function getFixes(
	runner: StylelintRunnerService,
	document: TextDocument,
	linterOptions: stylelint.LinterOptions = {},
	runnerOptions: RunnerOptions = {},
): Promise<TextEdit[]> {
	const result = await runner.lintDocument(
		document,
		{ ...linterOptions, fix: true },
		runnerOptions,
	);

	const fixedCode =
		typeof result.code === 'string'
			? result.code
			: typeof result.output === 'string' && result.output.length > 0
				? result.output
				: undefined;

	return typeof fixedCode === 'string' ? createTextEdits(document, fixedCode) : [];
}
