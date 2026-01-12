import { describe, it, expect } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as LSP from 'vscode-languageserver-protocol';
import { DisableRuleLineCodeActionService } from '../disable-rule-line-code-action.service';

const lineFactory = new DisableRuleLineCodeActionService({ EOL: '\n' });

describe('DisableRuleLineCodeActionFactory', () => {
	it('should create a code action to disable a rule for a line using the previous line', () => {
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
		const codeAction = lineFactory.create(document, diagnostic, 'separateLine');

		const edit = (codeAction.edit?.documentChanges?.[0] as LSP.TextDocumentEdit)?.edits?.[0];

		expect(codeAction).toMatchSnapshot();
		expect(edit?.range).toEqual(
			LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
		);
	});

	it('should match indentation of the line with the diagnostic when using the previous line', () => {
		const document = TextDocument.create(
			'file:///home/user/src/file.css',
			'css',
			1,
			'\t    body { color: red; }\n',
		);
		const diagnostic: LSP.Diagnostic = {
			message: 'Message',
			severity: LSP.DiagnosticSeverity.Error,
			range: LSP.Range.create(LSP.Position.create(0, 5), LSP.Position.create(0, 5)),
			source: 'Stylelint',
			code: 'rule',
		};
		const codeAction = lineFactory.create(document, diagnostic, 'separateLine');

		const edit = (codeAction.edit?.documentChanges?.[0] as LSP.TextDocumentEdit)?.edits?.[0];

		expect(edit?.newText).toMatch(/^\t {4}\S/);
	});

	it('should create a code action to disable a rule for a line using the same line', () => {
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
		const codeAction = lineFactory.create(document, diagnostic, 'sameLine');

		const edit = (codeAction.edit?.documentChanges?.[0] as LSP.TextDocumentEdit)?.edits?.[0];

		expect(codeAction).toMatchSnapshot();
		expect(edit?.range).toEqual(
			LSP.Range.create(
				LSP.Position.create(0, LSP.uinteger.MAX_VALUE),
				LSP.Position.create(0, LSP.uinteger.MAX_VALUE),
			),
		);
	});

	it('should use the provided line ending', () => {
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
		const win32Factory = new DisableRuleLineCodeActionService({ EOL: '\r\n' });
		const win32CodeAction = win32Factory.create(win32Document, win32Diagnostic, 'separateLine');
		const win32Edit = (win32CodeAction.edit?.documentChanges?.[0] as LSP.TextDocumentEdit)
			?.edits?.[0];

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
		const linuxFactory = new DisableRuleLineCodeActionService({ EOL: '\n' });
		const linuxCodeAction = linuxFactory.create(linuxDocument, linuxDiagnostic, 'separateLine');
		const linuxEdit = (linuxCodeAction.edit?.documentChanges?.[0] as LSP.TextDocumentEdit)
			?.edits?.[0];

		expect(win32Edit?.newText).toMatch(/\r\n$/);
		expect(linuxEdit?.newText).toMatch(/(?<!\r)\n$/);
	});
});
