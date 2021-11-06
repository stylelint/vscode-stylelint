import type winston from 'winston';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type LSP from 'vscode-languageserver-protocol';
import type {
	DidChangeValidateLanguagesParams,
	LanguageServerContext,
	LanguageServerModuleConstructorParameters,
	LanguageServerModule,
} from '../types';

export class ValidatorModule implements LanguageServerModule {
	static id = 'validator';

	/**
	 * The language server context.
	 */
	#context: LanguageServerContext;

	/**
	 * The logger to use, if any.
	 */
	#logger: winston.Logger | undefined;

	/**
	 * Diagnostics for each document by URI.
	 */
	#documentDiagnostics = new Map<LSP.DocumentUri, LSP.Diagnostic[]>();

	constructor({ context, logger }: LanguageServerModuleConstructorParameters) {
		this.#context = context;
		this.#logger = logger;
	}

	#shouldValidate(document: TextDocument): boolean {
		return this.#context.options.validate.includes(document.languageId);
	}

	async #validate(document: TextDocument): Promise<void> {
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

	async #validateAll(): Promise<void> {
		await Promise.allSettled(
			this.#context.documents.all().map((document) => this.#validate(document)),
		);
	}

	#clearDiagnostics({ uri }: TextDocument): void {
		this.#logger?.debug('Clearing diagnostics for document', { uri });

		this.#documentDiagnostics.delete(uri);
		this.#context.connection.sendDiagnostics({ uri, diagnostics: [] });

		this.#logger?.debug('Diagnostics cleared', { uri });
	}

	getDiagnostics(uri: string): LSP.Diagnostic[] {
		return this.#documentDiagnostics.get(uri) ?? [];
	}

	onInitialize(): void {
		void this.#validateAll();
	}

	onDidRegisterHandlers(): void {
		this.#logger?.debug('Registering handlers');

		this.#context.connection.onDidChangeWatchedFiles(async () => await this.#validateAll());

		this.#logger?.debug('onDidChangeWatchedFiles handler registered');

		this.#context.documents.onDidChangeContent(
			async ({ document }) => await this.#validate(document),
		);

		this.#logger?.debug('onDidChangeContent handler registered');

		this.#context.documents.onDidClose(({ document }) => {
			this.#clearDiagnostics(document);
		});

		this.#logger?.debug('onDidClose handler registered');
		this.#logger?.debug('Handlers registered');
	}

	async onDidChangeConfiguration(): Promise<void> {
		this.#logger?.debug('Received onDidChangeConfiguration');

		await this.#validateAll();
	}

	onDidChangeValidateLanguages({ removedLanguages }: DidChangeValidateLanguagesParams): void {
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
