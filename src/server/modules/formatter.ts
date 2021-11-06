import { DocumentFormattingRequest } from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type LSP from 'vscode-languageserver-protocol';
import { formattingOptionsToRules } from '../../utils/stylelint';
import { Notification } from '../types';
import type {
	DidChangeValidateLanguagesParams,
	LanguageServerContext,
	LanguageServerModuleConstructorParameters,
	LanguageServerModule,
} from '../types';
import type winston from 'winston';

export class FormatterModule implements LanguageServerModule {
	static id = 'formatter';

	/**
	 * The language server context.
	 */
	#context: LanguageServerContext;

	/**
	 * The logger to use, if any.
	 */
	#logger: winston.Logger | undefined;

	/**
	 * Whether or not dynamic registration for document formatting should be
	 * attempted.
	 */
	#registerDynamically = false;

	/**
	 * The disposable for the dynamically registered document formatter.
	 */
	#registration: LSP.Disposable | undefined = undefined;

	constructor({ context, logger }: LanguageServerModuleConstructorParameters) {
		this.#context = context;
		this.#logger = logger;
	}

	#shouldFormat(document: TextDocument): boolean {
		return this.#context.options.validate.includes(document.languageId);
	}

	onInitialize({ capabilities }: LSP.InitializeParams): Partial<LSP.InitializeResult> {
		this.#registerDynamically = Boolean(capabilities.textDocument?.formatting?.dynamicRegistration);

		return {
			capabilities: {
				// Use static registration if dynamic registration is not
				// supported by the client
				documentFormattingProvider: !this.#registerDynamically,
			},
		};
	}

	onDidRegisterHandlers(): void {
		this.#logger?.debug('Registering onDocumentFormatting handler');

		this.#context.connection.onDocumentFormatting(({ textDocument, options }) => {
			this.#logger?.debug('Received onDocumentFormatting', { textDocument, options });

			if (!textDocument) {
				this.#logger?.debug('No text document provided, ignoring');

				return null;
			}

			const { uri } = textDocument;
			const document = this.#context.documents.get(uri);

			if (!document || !this.#shouldFormat(document)) {
				if (this.#logger?.isDebugEnabled()) {
					if (!document) {
						this.#logger.debug('Unknown document, ignoring', { uri });
					} else {
						this.#logger.debug('Document should not be formatted, ignoring', {
							uri,
							language: document.languageId,
						});
					}
				}

				return null;
			}

			const linterOptions = {
				config: {
					rules: formattingOptionsToRules(options),
				},
			};

			this.#logger?.debug('Formatting document', { uri, linterOptions });

			const fixes = this.#context.getFixes(document, linterOptions);

			this.#logger?.debug('Returning fixes', { uri, fixes });

			return fixes;
		});

		this.#logger?.debug('onDocumentFormatting handler registered');
	}

	async onDidChangeValidateLanguages({
		languages,
	}: DidChangeValidateLanguagesParams): Promise<void> {
		if (this.#logger?.isDebugEnabled()) {
			this.#logger?.debug('Received onDidChangeValidateLanguages', { languages: [...languages] });
		}

		// If dynamic registration is supported and the list of languages that should be validated
		// has changed, then (re-)register the formatter.
		if (this.#registerDynamically) {
			// Dispose the old formatter registration if it exists.
			if (this.#registration) {
				this.#logger?.debug('Disposing old formatter registration');

				this.#registration.dispose();

				this.#logger?.debug('Old formatter registration disposed');
			}

			// If there are languages that should be validated, register a formatter for those
			// languages.
			if (languages.size > 0) {
				const documentSelector = [];

				for (const language of languages) {
					documentSelector.push({ language });
				}

				if (this.#logger?.isDebugEnabled()) {
					this.#logger?.debug('Registering formatter for languages', { languages: [...languages] });
				}

				this.#registration = await this.#context.connection.client.register(
					DocumentFormattingRequest.type,
					{ documentSelector },
				);

				this.#context.connection.sendNotification(
					Notification.DidRegisterDocumentFormattingEditProvider,
					{},
				);

				this.#logger?.debug('Formatter registered');
			}
		}
	}
}
