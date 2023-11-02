import { CompletionItemKind } from 'vscode-languageserver-types';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type LSP from 'vscode-languageserver-protocol';
import { getDisableType } from '../../utils/documents';
import { createDisableCompletionItem } from '../../utils/lsp';
import { DisableMetadataLookupTable, DisableReportRuleNames } from '../../utils/stylelint';
import type {
	LanguageServerContext,
	LanguageServerModuleConstructorParameters,
	LanguageServerModule,
} from '../types';
import type { ValidatorModule } from './validator';
import type winston from 'winston';

export class CompletionModule implements LanguageServerModule {
	static id = 'completion';

	/**
	 * The language server context.
	 */
	#context: LanguageServerContext;

	/**
	 * The logger to use, if any.
	 */
	#logger: winston.Logger | undefined;

	constructor({ context, logger }: LanguageServerModuleConstructorParameters) {
		this.#context = context;
		this.#logger = logger;
	}

	dispose(): void {
		this.#context.connection.onCompletion(() => undefined);
	}

	onInitialize(): Partial<LSP.InitializeResult> {
		return {
			capabilities: {
				completionProvider: {},
			},
		};
	}

	onDidRegisterHandlers(): void {
		this.#logger?.debug('Registering onCompletion handler');

		this.#context.connection.onCompletion(this.#onCompletion.bind(this));

		this.#logger?.debug('onCompletion handler registered');
	}

	async #shouldComplete(document: TextDocument): Promise<boolean> {
		const options = await this.#context.getOptions(document.uri);

		return (
			options.validate.includes(document.languageId) &&
			options.snippet.includes(document.languageId)
		);
	}

	async #onCompletion({
		textDocument,
		position,
	}: LSP.CompletionParams): Promise<LSP.CompletionItem[]> {
		const { uri } = textDocument;

		this.#logger?.debug('Received onCompletion', { uri, position });

		const document = this.#context.documents.get(uri);

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

		const validatorModule = this.#context.getModule('validator') as ValidatorModule | undefined;

		const diagnostics = validatorModule?.getDiagnostics(uri);

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

		const results: LSP.CompletionItem[] = [];

		const disableType = getDisableType(document, position);

		if (disableType === 'stylelint-disable-line') {
			for (const rule of thisLineRules) {
				results.push({
					label: rule,
					kind: CompletionItemKind.Snippet,
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
					kind: CompletionItemKind.Snippet,
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

		this.#logger?.debug('Returning completion items', { uri, results });

		return results;
	}
}
