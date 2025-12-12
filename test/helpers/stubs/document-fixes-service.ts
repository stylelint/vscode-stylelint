import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DocumentFixesService } from '../../../src/server/services/index.js';

export type DocumentFixesServiceStub = Pick<DocumentFixesService, 'getFixes'> & {
	setFixes(uri: string, edits: LSP.TextEdit[]): void;
	calls: Array<{ document: TextDocument; options?: unknown }>;
};

export function createDocumentFixesServiceStub(): DocumentFixesServiceStub {
	const fixes = new Map<string, LSP.TextEdit[]>();
	const calls: DocumentFixesServiceStub['calls'] = [];

	return {
		calls,
		setFixes: (uri: string, edits: LSP.TextEdit[]) => {
			fixes.set(uri, edits);
		},
		async getFixes(document: TextDocument, options?: unknown) {
			calls.push({ document, options });

			return fixes.get(document.uri) ?? [];
		},
	};
}
