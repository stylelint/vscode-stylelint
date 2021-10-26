'use strict';

const { CompletionItemKind } = require('vscode-languageserver-types');
const { getDisableType } = require('../../utils/documents');
const { createDisableCompletionItem } = require('../../utils/lsp');
const { DisableReportRuleNames } = require('../../utils/types');
const { DisableMetadataLookupTable } = require('../../utils/stylelint');

/**
 * @implements {LanguageServerModule}
 */
class CompletionModule {
	static id = 'completion';

	/**
	 * The language server context.
	 * @type {LanguageServerContext}
	 */
	#context;

	/**
	 * The logger to use, if any.
	 * @type {winston.Logger | undefined}
	 */
	#logger;

	/**
	 * @param {LanguageServerModuleConstructorParameters} params
	 */
	constructor({ context, logger }) {
		this.#context = context;
		this.#logger = logger;
	}

	/**
	 * @returns {Partial<lsp.InitializeResult>}
	 */
	onInitialize() {
		return {
			capabilities: {
				completionProvider: {},
			},
		};
	}

	/**
	 * @returns {void}
	 */
	onDidRegisterHandlers() {
		this.#logger?.debug('Registering onCompletion handler');

		this.#context.connection.onCompletion(this.#onCompletion.bind(this));

		this.#logger?.debug('onCompletion handler registered');
	}

	/**
	 * @param {lsp.TextDocument} document
	 * @returns {boolean}
	 */
	#shouldComplete(document) {
		return (
			this.#context.options.validate.includes(document.languageId) &&
			this.#context.options.snippet.includes(document.languageId)
		);
	}

	/**
	 * @param {lsp.CompletionParams} params
	 * @returns {lsp.CompletionItem[]}
	 */
	#onCompletion({ textDocument, position }) {
		const { uri } = textDocument;

		this.#logger?.debug('Received onCompletion', { uri, position });

		const document = this.#context.documents.get(uri);

		if (!document || !this.#shouldComplete(document)) {
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

		const validatorModule = /** @type {import('./validator').ValidatorModule | undefined} */ (
			this.#context.getModule('validator')
		);

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

		const thisLineRules = new Set();
		const nextLineRules = new Set();

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

		/** @type {lsp.CompletionItem[]} */
		const results = [];

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
					thisLineRules.size === 1 ? thisLineRules.values().next().value : undefined,
				),
			);

			results.push(
				createDisableCompletionItem(
					'stylelint-disable-next-line',
					nextLineRules.size === 1 ? nextLineRules.values().next().value : undefined,
				),
			);

			results.push(createDisableCompletionItem('stylelint-disable'));
		}

		this.#logger?.debug('Returning completion items', { uri, results });

		return results;
	}
}

module.exports = {
	CompletionModule,
};
