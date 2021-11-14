jest.mock('os');

import os from 'os';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as LSP from 'vscode-languageserver-protocol';
import { createDisableRuleFileCodeAction } from '../create-disable-rule-file-code-action';

const mockedOS = os as tests.mocks.OSModule;

describe('createDisableRuleFileCodeAction', () => {
	beforeEach(() => {
		mockedOS.__mockPlatform('linux');
	});

	it('should create a code action to disable a rule for an entire file', () => {
		const document = TextDocument.create(
			'file:///home/user/src/file.css',
			'css',
			1,
			'body { color: red; }\n',
		);
		const diagnostic: LSP.Diagnostic = {
			message: 'Message',
			severity: LSP.DiagnosticSeverity.Error,
			range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
			source: 'Stylelint',
			code: 'rule',
		};
		const codeAction = createDisableRuleFileCodeAction(document, diagnostic);

		const edit = (codeAction.edit?.documentChanges?.[0] as LSP.TextDocumentEdit)?.edits?.[0];

		expect(codeAction).toMatchSnapshot();
		expect(edit?.range).toEqual(
			LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
		);
	});

	it('should place the code action on the second line if the file has a shebang', () => {
		const document = TextDocument.create(
			'file:///home/user/src/file.js',
			'javascript',
			1,
			'#!/usr/bin/env node\n\nconst css = `body { color: red; }`;\n',
		);
		const diagnostic: LSP.Diagnostic = {
			message: 'Message',
			severity: LSP.DiagnosticSeverity.Error,
			range: LSP.Range.create(LSP.Position.create(2, 13), LSP.Position.create(2, 13)),
			source: 'Stylelint',
			code: 'rule',
		};
		const codeAction = createDisableRuleFileCodeAction(document, diagnostic);

		const edit = (codeAction.edit?.documentChanges?.[0] as LSP.TextDocumentEdit)?.edits?.[0];

		expect(codeAction).toMatchSnapshot();
		expect(edit?.range).toEqual(
			LSP.Range.create(LSP.Position.create(1, 0), LSP.Position.create(1, 0)),
		);
	});

	it('should use the platform-specific line ending', () => {
		mockedOS.__mockPlatform('win32');

		const win32Document = TextDocument.create(
			'file:///home/user/src/file.css',
			'css',
			1,
			'body { color: red; }\r\n',
		);
		const win32Diagnostic: LSP.Diagnostic = {
			message: 'Message',
			severity: LSP.DiagnosticSeverity.Error,
			range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
			source: 'Stylelint',
			code: 'rule',
		};
		const win32CodeAction = createDisableRuleFileCodeAction(win32Document, win32Diagnostic);
		const win32Edit = (win32CodeAction.edit?.documentChanges?.[0] as LSP.TextDocumentEdit)
			?.edits?.[0];

		mockedOS.__mockPlatform('linux');

		const linuxDocument = TextDocument.create(
			'file:///home/user/src/file.css',
			'css',
			1,
			'body { color: red; }\n',
		);
		const linuxDiagnostic: LSP.Diagnostic = {
			message: 'Message',
			severity: LSP.DiagnosticSeverity.Error,
			range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
			source: 'Stylelint',
			code: 'rule',
		};
		const linuxCodeAction = createDisableRuleFileCodeAction(linuxDocument, linuxDiagnostic);
		const linuxEdit = (linuxCodeAction.edit?.documentChanges?.[0] as LSP.TextDocumentEdit)
			?.edits?.[0];

		expect(win32Edit?.newText).toMatch(/\r\n$/);
		expect(linuxEdit?.newText).toMatch(/(?<!\r)\n$/);
	});
});
