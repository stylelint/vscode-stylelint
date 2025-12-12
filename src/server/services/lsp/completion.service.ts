import * as LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocuments } from 'vscode-languageserver/node';
import type winston from 'winston';

import { inject } from '../../../di/index.js';
import { getDisableType, createDisableCompletionItem } from '../../utils/index.js';
import { completionRequest, initialize, lspService } from '../../decorators.js';
import { DisableMetadataLookupTable, DisableReportRuleNames } from '../../stylelint/index.js';
import { textDocumentsToken } from '../../tokens.js';
import { DocumentDiagnosticsService } from '../documents/document-diagnostics.service.js';
import { type LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';
import { WorkspaceOptionsService } from '../workspace/workspace-options.service.js';

@lspService()
@inject({
	inject: [
		textDocumentsToken,
		WorkspaceOptionsService,
		DocumentDiagnosticsService,
		loggingServiceToken,
	],
})
export class CompletionService {
	#documents: TextDocuments<TextDocument>;
	#options: WorkspaceOptionsService;
	#diagnostics: DocumentDiagnosticsService;
	#logger?: winston.Logger;

	constructor(
		documents: TextDocuments<TextDocument>,
		options: WorkspaceOptionsService,
		diagnostics: DocumentDiagnosticsService,
		loggingService: LoggingService,
	) {
		this.#documents = documents;
		this.#options = options;
		this.#diagnostics = diagnostics;
		this.#logger = loggingService.createLogger(CompletionService);
	}

	@initialize()
	onInitialize(): Partial<LSP.InitializeResult> | void {
		return {
			capabilities: {
				completionProvider: {},
			},
		};
	}

	async #shouldComplete(document: TextDocument): Promise<boolean> {
		const options = await this.#options.getOptions(document.uri);

		return (
			options.validate.includes(document.languageId) &&
			options.snippet.includes(document.languageId)
		);
	}

	@completionRequest()
	async handleCompletion(
		params: LSP.CompletionParams,
	): Promise<LSP.CompletionItem[] | LSP.CompletionList | undefined | null> {
		const { textDocument, position } = params;
		const { uri } = textDocument;

		this.#logger?.debug('Received onCompletion', { uri, position });

		const document = this.#documents.get(uri);

		if (!document || !(await this.#shouldComplete(document))) {
			if (this.#logger?.isDebugEnabled()) {
				if (!document) {
					this.#logger.debug('Unknown document, ignoring', { uri });
				} else {
					this.#logger.debug('Snippets or validation not enabled for language, ignoring', {
						uri,
						language: document.languageId,
					});
				}
			}

			return [];
		}

		const diagnostics = this.#diagnostics.getDiagnostics(uri);

		if (!diagnostics || diagnostics.length === 0) {
			const items = [
				createDisableCompletionItem('stylelint-disable-line'),
				createDisableCompletionItem('stylelint-disable-next-line'),
				createDisableCompletionItem('stylelint-disable'),
			];

			this.#logger?.debug('No diagnostics for document, returning generic completion items', {
				uri,
				items,
			});

			return items;
		}

		const thisLineRules = new Set<string>();
		const nextLineRules = new Set<string>();
		const disableTable = new DisableMetadataLookupTable(diagnostics);

		for (const { code, range } of diagnostics) {
			if (
				!code ||
				typeof code !== 'string' ||
				code === 'CssSyntaxError' ||
				disableTable.find({
					type: DisableReportRuleNames.Needless,
					rule: code,
					range,
				}).size > 0
			) {
				continue;
			}

			if (range.start.line === position.line) {
				thisLineRules.add(code);
			} else if (range.start.line === position.line + 1) {
				nextLineRules.add(code);
			}
		}

		return this.#createCompletionItems(document, position, thisLineRules, nextLineRules);
	}

	#createCompletionItems(
		document: TextDocument,
		position: LSP.Position,
		thisLineRules: Set<string>,
		nextLineRules: Set<string>,
	): LSP.CompletionItem[] {
		const disableType = getDisableType(document, position);
		const results: LSP.CompletionItem[] = [];

		if (disableType === 'stylelint-disable-line') {
			for (const rule of thisLineRules) {
				results.push({
					label: rule,
					kind: LSP.CompletionItemKind.Snippet,
					detail: `disable ${rule} rule. (Stylelint)`,
				});
			}
		} else if (
			disableType === 'stylelint-disable' ||
			disableType === 'stylelint-disable-next-line'
		) {
			for (const rule of nextLineRules) {
				results.push({
					label: rule,
					kind: LSP.CompletionItemKind.Snippet,
					detail: `disable ${rule} rule. (Stylelint)`,
				});
			}
		} else {
			results.push(
				createDisableCompletionItem(
					'stylelint-disable-line',
					thisLineRules.size === 1 ? (thisLineRules.values().next().value as string) : undefined,
				),
			);

			results.push(
				createDisableCompletionItem(
					'stylelint-disable-next-line',
					nextLineRules.size === 1 ? (nextLineRules.values().next().value as string) : undefined,
				),
			);

			results.push(createDisableCompletionItem('stylelint-disable'));
		}

		this.#logger?.debug('Returning completion items', { uri: document.uri, results });

		return results;
	}
}
