import os from 'os';
import * as LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { inject } from '../../../../di/index.js';
import { OsModuleToken } from '../../../tokens.js';

export type DisableRuleLineCodeActionLocation = 'sameLine' | 'separateLine';

/**
 * Service that creates code actions that disable a rule for a particular line.
 */
@inject({ inject: [OsModuleToken] })
export class DisableRuleLineCodeActionService {
	#eol: string;

	constructor(osModule?: Pick<typeof os, 'EOL'>) {
		this.#eol = (osModule ?? os).EOL;
	}

	create(
		document: TextDocument,
		{ code, range }: LSP.Diagnostic,
		location: DisableRuleLineCodeActionLocation,
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
						`${indentation}/* stylelint-disable-next-line ${code} */${this.#eol}`,
					),
				);
		}

		return LSP.CodeAction.create(
			`Disable ${code} for this line`,
			workspaceChange.edit,
			LSP.CodeActionKind.QuickFix,
		);
	}
}
