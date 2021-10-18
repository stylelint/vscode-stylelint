'use strict';

const { CompletionItemKind } = require('vscode-languageserver-types');
const { getDisableType } = require('../utils/documents');
const { createDisableCompletionItem } = require('../utils/lsp');

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
		return this.#context.options.validate.includes(document.languageId);
	}

	/**
	 * @param {lsp.Diagnostic} diagnostic
	 * @returns {string}
	 */
	#computeKey(diagnostic) {
		const range = diagnostic.range;

		return `[${range.start.line},${range.start.character},${range.end.line},${range.end.character}]-${diagnostic.code}`;
	}

	/**
	 * @param {lsp.CompletionParams} params
	 * @returns {lsp.CompletionItem[]}
	 */
	#onCompletion({ textDocument, position }) {
		const { uri } = textDocument;

		this.#logger?.debug('Received onCompletion', { uri, position });

		const document = this.#context.documents.get(uri);

		const shouldComplete = document && this.#shouldComplete(document);

		if (
			!document ||
			!shouldComplete ||
			!this.#context.options.snippet.includes(document.languageId)
		) {
			if (this.#logger?.isDebugEnabled()) {
				if (!document) {
					this.#logger.debug('Unknown document, ignoring', { uri });
				} else if (!shouldComplete) {
					this.#logger.debug('Document should not be validated, ignoring', {
						uri,
						language: document.languageId,
					});
				} else {
					this.#logger.debug('Snippets not enabled for language, ignoring', {
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

		/** @type {Set<string>} */
		const needlessDisablesKeys = new Set();

		const thisLineRules = new Set();
		const nextLineRules = new Set();

		for (const diagnostic of diagnostics) {
			if (needlessDisablesKeys.has(this.#computeKey(diagnostic))) {
				continue;
			}

			const start = diagnostic.range.start;

			const rule = diagnostic.code ?? '';

			if (start.line === position.line) {
				thisLineRules.add(rule);
			} else if (start.line === position.line + 1) {
				nextLineRules.add(rule);
			}
		}

		thisLineRules.delete('');
		thisLineRules.delete('CssSyntaxError');
		nextLineRules.delete('');
		nextLineRules.delete('CssSyntaxError');

		/** @type {lsp.CompletionItem[]} */
		const results = [];

		const disableKind = getDisableType(document, position);

		if (disableKind) {
			if (disableKind === 'stylelint-disable-line') {
				for (const rule of thisLineRules) {
					results.push({
						label: rule,
						kind: CompletionItemKind.Snippet,
						detail: `disable ${rule} rule. (stylelint)`,
					});
				}
			} else if (
				disableKind === 'stylelint-disable' ||
				disableKind === 'stylelint-disable-next-line'
			) {
				for (const rule of nextLineRules) {
					results.push({
						label: rule,
						kind: CompletionItemKind.Snippet,
						detail: `disable ${rule} rule. (stylelint)`,
					});
				}
			}
		} else {
			if (thisLineRules.size === 1) {
				results.push(createDisableCompletionItem('stylelint-disable-line', [...thisLineRules][0]));
			} else {
				results.push(createDisableCompletionItem('stylelint-disable-line'));
			}

			if (nextLineRules.size === 1) {
				results.push(
					createDisableCompletionItem('stylelint-disable-next-line', [...nextLineRules][0]),
				);
			} else {
				results.push(createDisableCompletionItem('stylelint-disable-next-line'));
			}

			results.push(createDisableCompletionItem('stylelint-disable'));
		}

		this.#logger?.debug('Returning completion items', { uri, results });

		return results;
	}
}

module.exports = {
	CompletionModule,
};
