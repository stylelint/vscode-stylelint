'use strict';

/**
 * @implements {LanguageServerModule}
 */
class ValidatorModule {
	static id = 'validator';

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
	 * Diagnostics for each document by URI.
	 * @type {Map<lsp.DocumentUri, lsp.Diagnostic[]>}
	 */
	#documentDiagnostics = new Map();

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
	#shouldValidate(document) {
		return this.#context.options.validate.includes(document.languageId);
	}

	/**
	 * @param {lsp.TextDocument} document
	 * @returns {Promise<void>}
	 */
	async #validate(document) {
		if (!this.#shouldValidate(document)) {
			this.#logger?.debug('Document should not be validated, ignoring', {
				uri: document.uri,
				language: document.languageId,
			});

			return;
		}

		const result = await this.#context.lintDocument(document);

		if (!result) {
			this.#logger?.debug('No lint result, ignoring', { uri: document.uri });

			return;
		}

		this.#logger?.debug('Sending diagnostics', { uri: document.uri, result });

		try {
			this.#context.connection.sendDiagnostics({
				uri: document.uri,
				diagnostics: result.diagnostics,
			});
			this.#documentDiagnostics.set(document.uri, result.diagnostics);

			this.#logger?.debug('Diagnostics sent', { uri: document.uri });
		} catch (error) {
			this.#context.displayError(error);

			this.#logger?.error('Failed to send diagnostics', { uri: document.uri, error });
		}
	}

	/**
	 * @returns {Promise<void>}
	 */
	async #validateAll() {
		await Promise.allSettled(
			this.#context.documents.all().map((document) => this.#validate(document)),
		);
	}

	/**
	 * @param {lsp.TextDocument} document
	 * @returns {void}
	 */
	#clearDiagnostics({ uri }) {
		this.#logger?.debug('Clearing diagnostics for document', { uri });

		this.#documentDiagnostics.delete(uri);
		this.#context.connection.sendDiagnostics({ uri, diagnostics: [] });

		this.#logger?.debug('Diagnostics cleared', { uri });
	}

	/**
	 * @param {string} uri
	 * @returns {lsp.Diagnostic[]}
	 */
	getDiagnostics(uri) {
		return this.#documentDiagnostics.get(uri) ?? [];
	}

	/**
	 * @returns {void}
	 */
	onInitialize() {
		void this.#validateAll();
	}

	/**
	 * @returns {void}
	 */
	onDidRegisterHandlers() {
		this.#logger?.debug('Registering handlers');

		this.#context.connection.onDidChangeWatchedFiles(() => void this.#validateAll());

		this.#logger?.debug('onDidChangeWatchedFiles handler registered');

		this.#context.documents.onDidChangeContent(({ document }) => void this.#validate(document));

		this.#logger?.debug('onDidChangeContent handler registered');

		this.#context.documents.onDidClose(({ document }) => {
			this.#clearDiagnostics(document);
		});

		this.#logger?.debug('onDidClose handler registered');
		this.#logger?.debug('Handlers registered');
	}

	/**
	 * @returns {void}
	 */
	onDidChangeConfiguration() {
		this.#logger?.debug('Received onDidChangeConfiguration');

		void this.#validateAll();
	}

	/**
	 * @param {DidChangeValidateLanguagesParams} params
	 * @returns {void}
	 */
	onDidChangeValidateLanguages({ removedLanguages }) {
		if (this.#logger?.isDebugEnabled()) {
			this.#logger?.debug('Received onDidChangeValidateLanguages', {
				removedLanguages: [...removedLanguages],
			});
		}

		for (const document of this.#context.documents.all()) {
			if (removedLanguages.has(document.languageId)) {
				this.#clearDiagnostics(document);
			}
		}
	}
}

module.exports = {
	ValidatorModule,
};
