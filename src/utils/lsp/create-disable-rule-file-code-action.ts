import os from 'os';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as LSP from 'vscode-languageserver-protocol';

/**
 * Creates a code action that disables a rule for an entire file.
 * @param document The document to apply the code action to.
 * @param diagnostic The diagnostic corresponding to the rule to disable.
 */
export function createDisableRuleFileCodeAction(
	document: TextDocument,
	{ code }: LSP.Diagnostic,
): LSP.CodeAction {
	const workspaceChange = new LSP.WorkspaceChange();

	const shebang = document.getText(
		LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 2)),
	);

	workspaceChange
		.getTextEditChange(document)
		.add(
			LSP.TextEdit.insert(
				LSP.Position.create(shebang === '#!' ? 1 : 0, 0),
				`/* stylelint-disable ${code} */${os.EOL}`,
			),
		);

	return LSP.CodeAction.create(
		`Disable ${code} for the entire file`,
		workspaceChange.edit,
		LSP.CodeActionKind.QuickFix,
	);
}
