import type stylelint from 'stylelint';
import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DocumentFixesService } from '../../../src/server/services/index.js';

export type DocumentFixesServiceStub = Pick<DocumentFixesService, 'getFixes' | 'resolveConfig'> & {
	setFixes(uri: string, edits: LSP.TextEdit[]): void;
	setResolvedConfig(uri: string, config: stylelint.Config | undefined): void;
	calls: Array<{ document: TextDocument; options?: unknown }>;
	resolveConfigCalls: Array<{ document: TextDocument }>;
};

export function createDocumentFixesServiceStub(): DocumentFixesServiceStub {
	const fixes = new Map<string, LSP.TextEdit[]>();
	const resolvedConfigs = new Map<string, stylelint.Config | undefined>();
	const calls: DocumentFixesServiceStub['calls'] = [];
	const resolveConfigCalls: DocumentFixesServiceStub['resolveConfigCalls'] = [];

	return {
		calls,
		resolveConfigCalls,
		setFixes: (uri: string, edits: LSP.TextEdit[]) => {
			fixes.set(uri, edits);
		},
		setResolvedConfig: (uri: string, config: stylelint.Config | undefined) => {
			resolvedConfigs.set(uri, config);
		},
		async getFixes(document: TextDocument, options?: unknown) {
			calls.push({ document, options });

			return fixes.get(document.uri) ?? [];
		},
		async resolveConfig(document: TextDocument) {
			resolveConfigCalls.push({ document });

			return resolvedConfigs.get(document.uri);
		},
	};
}
