import os from 'os';
import * as LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { inject } from '../../../../di/index.js';
import { OsModuleToken } from '../../../tokens.js';

/**
 * Service that creates code actions that disable a rule for an entire file.
 */
@inject({ inject: [OsModuleToken] })
export class DisableRuleFileCodeActionService {
	#eol: string;

	constructor(osModule?: Pick<typeof os, 'EOL'>) {
		this.#eol = (osModule ?? os).EOL;
	}

	create(document: TextDocument, { code }: LSP.Diagnostic): LSP.CodeAction {
		const workspaceChange = new LSP.WorkspaceChange();

		const shebang = document.getText(
			LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 2)),
		);

		workspaceChange
			.getTextEditChange(document)
			.add(
				LSP.TextEdit.insert(
					LSP.Position.create(shebang === '#!' ? 1 : 0, 0),
					`/* stylelint-disable ${code} */${this.#eol}`,
				),
			);

		return LSP.CodeAction.create(
			`Disable ${code} for the entire file`,
			workspaceChange.edit,
			LSP.CodeActionKind.QuickFix,
		);
	}
}
