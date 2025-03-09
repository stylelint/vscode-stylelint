import { TextDocument } from 'vscode-languageserver-textdocument';
import * as LSP from 'vscode-languageserver-protocol';

import { getEditInfo } from '../get-edit-info';

const DOCUMENT_VERSION = 1;
const createDocument = (code: string) =>
	TextDocument.create('file:///path/test.css', 'css', DOCUMENT_VERSION, code);

describe('getEditInfo', () => {
	it('should construct and return an EditInfo', async () => {
		const document = createDocument('a {color: #000;}');

		const warning = {
			rule: 'color-hex-length',
			text: `Expected "#000" to be "#000000" (color-hex-length)`,
			line: 1,
			column: 10,
			endLine: 1,
			endColumn: 14,
			severity: 'error' as const,
			fix: {
				range: [12, 13] as [number, number],
				text: '0000',
			},
		};
		const diagnostic = {
			range: {
				start: document.positionAt(10),
				end: document.positionAt(14),
			},
			message: `Expected "#000" to be "#000000" (color-hex-length)`,
			source: 'stylelint',
			severity: LSP.DiagnosticSeverity.Error,
			code: 'color-hex-length',
		};

		const editInfo = getEditInfo(document, diagnostic, {
			version: DOCUMENT_VERSION,
			diagnostics: [diagnostic],
			getWarning: () => warning,
		});

		expect(editInfo).toMatchSnapshot();
	});

	it('should return undefined if the document does not have a lint result', async () => {
		const document = createDocument('a {color: #000;}');
		const diagnostic = {
			range: {
				start: document.positionAt(10),
				end: document.positionAt(14),
			},
			message: `Expected "#000" to be "#000000" (color-hex-length)`,
			source: 'stylelint',
			severity: LSP.DiagnosticSeverity.Error,
			code: 'color-hex-length',
		};

		const editInfo = getEditInfo(document, diagnostic, undefined);

		expect(editInfo).toBeUndefined();
	});

	it('should return undefined if the document version does not match', async () => {
		const document = createDocument('a {color: #000;}');
		const warning = {
			rule: 'color-hex-length',
			text: `Expected "#000" to be "#000000" (color-hex-length)`,
			line: 1,
			column: 10,
			endLine: 1,
			endColumn: 14,
			severity: 'error' as const,
			fix: {
				range: [12, 13] as [number, number],
				text: '0000',
			},
		};
		const diagnostic = {
			range: {
				start: document.positionAt(10),
				end: document.positionAt(14),
			},
			message: `Expected "#000" to be "#000000" (color-hex-length)`,
			source: 'stylelint',
			severity: LSP.DiagnosticSeverity.Error,
			code: 'color-hex-length',
		};

		const editInfo = getEditInfo(document, diagnostic, {
			version: 2,
			diagnostics: [diagnostic],
			getWarning: () => warning,
		});

		expect(editInfo).toBeUndefined();
	});

	it('should return undefined if the diagnostic has no warning', async () => {
		const document = createDocument('a {color: #000;}');
		const diagnostic = {
			range: {
				start: document.positionAt(10),
				end: document.positionAt(14),
			},
			message: `Expected "#000" to be "#000000" (color-hex-length)`,
			source: 'stylelint',
			severity: LSP.DiagnosticSeverity.Error,
			code: 'color-hex-length',
		};

		const editInfo = getEditInfo(document, diagnostic, {
			version: DOCUMENT_VERSION,
			diagnostics: [diagnostic],
			getWarning: () => null,
		});

		expect(editInfo).toBeUndefined();
	});

	it('should return undefined if the warning has no fix', async () => {
		const document = createDocument('a {color: #000;}');

		const warning = {
			rule: 'color-hex-length',
			text: `Expected "#000" to be "#000000" (color-hex-length)`,
			line: 1,
			column: 10,
			endLine: 1,
			endColumn: 14,
			severity: 'error' as const,
		};
		const diagnostic = {
			range: {
				start: document.positionAt(10),
				end: document.positionAt(14),
			},
			message: `Expected "#000" to be "#000000" (color-hex-length)`,
			source: 'stylelint',
			severity: LSP.DiagnosticSeverity.Error,
			code: 'color-hex-length',
		};

		const editInfo = getEditInfo(document, diagnostic, {
			version: DOCUMENT_VERSION,
			diagnostics: [diagnostic],
			getWarning: () => warning,
		});

		expect(editInfo).toBeUndefined();
	});
});
