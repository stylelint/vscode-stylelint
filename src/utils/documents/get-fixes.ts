import { createTextEdits } from './create-text-edits';
// eslint-disable-next-line n/no-unpublished-import
import type stylelint from 'stylelint';
import type { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import type { StylelintRunner, RunnerOptions } from '../stylelint/index';

/**
 * Runs Stylelint and returns fix text edits for the given document.
 * @param runner The Stylelint runner.
 * @param document The document to get fixes for.
 * @param linterOptions Linter options to use.
 * @param runnerOptions The runner options.
 */
export async function getFixes(
	runner: StylelintRunner,
	document: TextDocument,
	linterOptions: stylelint.LinterOptions = {},
	runnerOptions: RunnerOptions = {},
): Promise<TextEdit[]> {
	const result = await runner.lintDocument(
		document,
		{ ...linterOptions, fix: true },
		runnerOptions,
	);

	return typeof result.output === 'string' ? createTextEdits(document, result.output) : [];
}
