'use strict';

const { CodeActionKind, CodeAction, TextDocumentEdit } = require('vscode-languageserver-types');
const { CodeActionKind: StylelintCodeActionKind } = require('../../utils/types');

/**
 * @implements {LanguageServerModule}
 */
class CodeActionModule {
	static id = 'code-action';

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
	 * @param {lsp.TextDocument} document
	 * @returns {boolean}
	 */
	#shouldCodeAction(document) {
		return this.#context.options.validate.includes(document.languageId);
	}

	/**
	 * @returns {Partial<lsp.InitializeResult>}
	 */
	onInitialize() {
		return {
			capabilities: {
				codeActionProvider: {
					codeActionKinds: [CodeActionKind.QuickFix, StylelintCodeActionKind.StylelintSourceFixAll],
				},
			},
		};
	}

	/**
	 * @returns {void}
	 */
	onDidRegisterHandlers() {
		this.#logger?.debug('Registering onCodeAction handler');

		this.#context.connection.onCodeAction(async ({ context, textDocument }) => {
			this.#logger?.debug('Received onCodeAction', { context, uri: textDocument.uri });

			const only = context.only !== undefined ? context.only[0] : undefined;
			const isSource = only === CodeActionKind.Source;
			const isSourceFixAll =
				only === StylelintCodeActionKind.StylelintSourceFixAll ||
				only === CodeActionKind.SourceFixAll;

			if (!isSourceFixAll && !isSource) {
				this.#logger?.debug('Unsupported code action kind, ignoring', { kind: only });

				return [];
			}

			const uri = textDocument.uri;
			const document = this.#context.documents.get(uri);

			if (!document || !this.#shouldCodeAction(document)) {
				if (this.#logger?.isDebugEnabled()) {
					if (!document) {
						this.#logger.debug('Unknown document, ignoring', { uri });
					} else {
						this.#logger.debug('Document should not be validated, ignoring', {
							uri,
							language: document.languageId,
						});
					}
				}

				return [];
			}

			const identifier = { uri: document.uri, version: document.version };
			const edits = await this.#context.getFixes(document);

			const actions = [
				CodeAction.create(
					`Fix all Stylelint auto-fixable problems`,
					{ documentChanges: [TextDocumentEdit.create(identifier, edits)] },
					StylelintCodeActionKind.StylelintSourceFixAll,
				),
			];

			this.#logger?.debug('Returning code actions', { actions });

			return actions;
		});

		this.#logger?.debug('onCodeAction handler registered');
	}
}

module.exports = {
	CodeActionModule,
};
