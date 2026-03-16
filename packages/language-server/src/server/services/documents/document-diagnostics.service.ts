import type LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type winston from 'winston';
import { inject } from '../../../di/inject.js';
import type { LintDiagnostics } from '../../stylelint/index.js';
import { type LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';

export type DocumentLintResult = (LintDiagnostics & { version: number }) | undefined;

@inject({
	inject: [loggingServiceToken],
})
export class DocumentDiagnosticsService {
	#logger?: winston.Logger;
	#diagnostics = new Map<string, LSP.Diagnostic[]>();
	#lintResults = new Map<string, Exclude<DocumentLintResult, undefined>>();

	constructor(loggingService: LoggingService) {
		this.#logger = loggingService.createLogger(DocumentDiagnosticsService);
	}

	set(document: TextDocument, diagnostics: LSP.Diagnostic[], lintResult?: LintDiagnostics): void {
		this.#diagnostics.set(document.uri, diagnostics);

		if (lintResult) {
			this.#lintResults.set(document.uri, { ...lintResult, version: document.version });
		} else {
			this.#lintResults.delete(document.uri);
		}

		this.#logger?.debug('Updated diagnostics cache', {
			uri: document.uri,
			diagnostics: diagnostics.length,
			hasLintResult: Boolean(lintResult),
		});
	}

	clear(uri: string): void {
		this.#diagnostics.delete(uri);
		this.#lintResults.delete(uri);

		this.#logger?.debug('Cleared diagnostics cache', { uri });
	}

	getDiagnostics(uri: string): LSP.Diagnostic[] {
		return this.#diagnostics.get(uri) ?? [];
	}

	getLintResult(uri: string): DocumentLintResult {
		return this.#lintResults.get(uri);
	}
}
