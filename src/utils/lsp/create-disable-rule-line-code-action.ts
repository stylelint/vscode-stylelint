import os from 'os';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as LSP from 'vscode-languageserver-protocol';

/**
 * Creates a code action that disables a rule for a particular line.
 * @param document The document to apply the code action to.
 * @param diagnostic The diagnostic corresponding to the rule to disable.
 * @param location Whether to disable the rule on the line containing the
 * diagnostic or on the line before the diagnostic.
 */
export function createDisableRuleLineCodeAction(
	document: TextDocument,
	{ code, range }: LSP.Diagnostic,
	location: 'sameLine' | 'separateLine',
): LSP.CodeAction {
	const workspaceChange = new LSP.WorkspaceChange();

	if (location === 'sameLine') {
		workspaceChange
			.getTextEditChange(document)
			.add(
				LSP.TextEdit.insert(
					LSP.Position.create(range.start.line, LSP.uinteger.MAX_VALUE),
					` /* stylelint-disable-line ${code} */`,
				),
			);
	} else {
		const lineText = document.getText(
			LSP.Range.create(
				LSP.Position.create(range.start.line, 0),
				LSP.Position.create(range.start.line, LSP.uinteger.MAX_VALUE),
			),
		);
		const indentation = lineText.match(/^([ \t]+)/)?.[1] ?? '';

		workspaceChange
			.getTextEditChange(document)
			.add(
				LSP.TextEdit.insert(
					LSP.Position.create(range.start.line, 0),
					`${indentation}/* stylelint-disable-next-line ${code} */${os.EOL}`,
				),
			);
	}

	return LSP.CodeAction.create(
		`Disable ${code} for this line`,
		workspaceChange.edit,
		LSP.CodeActionKind.QuickFix,
	);
}
