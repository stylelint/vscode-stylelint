import type { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import type { LintDiagnostics } from '../../stylelint/index.js';
import type LSP from 'vscode-languageserver-protocol';

/**
 * Get the edit info for a diagnostic.
 * @param document The document to get edit info for.
 * @param diagnostic The diagnostic to get edit info for.
 */
export function getEditInfo(
	document: TextDocument,
	diagnostic: LSP.Diagnostic,
	lintResult:
		| (LintDiagnostics & {
				version: number;
		  })
		| undefined,
): { label: string; edit: TextEdit } | undefined {
	if (!lintResult || document.version !== lintResult.version) {
		return undefined;
	}

	const warning = lintResult.getWarning?.(diagnostic);

	if (!warning) {
		return undefined;
	}

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore -- (TS2353) `fix` property is available since v16.15.
	const edit = warning.fix;

	if (!edit) {
		return undefined;
	}

	return {
		label: `Fix this ${warning.rule} problem`,
		edit: {
			newText: edit.text,
			range: {
				start: document.positionAt(edit.range[0]),
				end: document.positionAt(edit.range[1]),
			},
		},
	};
}
