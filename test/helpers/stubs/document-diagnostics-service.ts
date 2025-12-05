import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type {
	DocumentDiagnosticsService,
	DocumentLintResult,
} from '../../../src/server/services/index.js';
import type { LintDiagnostics } from '../../../src/server/stylelint/index.js';

export type DocumentDiagnosticsServiceStub = Pick<
	DocumentDiagnosticsService,
	'getDiagnostics' | 'set' | 'clear' | 'getLintResult'
> & {
	setDiagnostics(uri: string, diagnostics: LSP.Diagnostic[]): void;
	setCachedDiagnostics(uri: string, diagnostics: LSP.Diagnostic[]): void;
	setCalls: Array<{ document: TextDocument; diagnostics: LSP.Diagnostic[] }>;
	clearCalls: string[];
	setLintResult(uri: string, result: DocumentLintResult | undefined): void;
};

export function createDocumentDiagnosticsServiceStub(): DocumentDiagnosticsServiceStub {
	const diagnostics = new Map<string, LSP.Diagnostic[]>();
	const lintResults = new Map<string, DocumentLintResult | LintDiagnostics | undefined>();
	const setCalls: DocumentDiagnosticsServiceStub['setCalls'] = [];
	const clearCalls: string[] = [];

	return {
		setCalls,
		clearCalls,
		setDiagnostics: (uri: string, values: LSP.Diagnostic[]) => {
			diagnostics.set(uri, values);
		},
		setCachedDiagnostics: (uri: string, values: LSP.Diagnostic[]) => {
			diagnostics.set(uri, values);
		},
		getDiagnostics: (uri: string) => diagnostics.get(uri) ?? [],
		set: (document: TextDocument, values: LSP.Diagnostic[], lintResult?: LintDiagnostics) => {
			diagnostics.set(document.uri, values);
			setCalls.push({ document, diagnostics: values });

			if (lintResult) {
				lintResults.set(document.uri, lintResult);
			}
		},
		clear: (uri: string) => {
			diagnostics.delete(uri);
			clearCalls.push(uri);
		},
		setLintResult: (uri: string, result: DocumentLintResult | undefined) => {
			lintResults.set(uri, result);
		},
		getLintResult: (uri: string) => lintResults.get(uri) as DocumentLintResult | undefined,
	};
}
