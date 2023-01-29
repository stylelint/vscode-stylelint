import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as LSP from 'vscode-languageserver-protocol';
import { formattingOptionsToRules } from '../../utils/stylelint';
import { Notification } from '../types';
import type {
	LanguageServerContext,
	LanguageServerModuleConstructorParameters,
	LanguageServerModule,
} from '../types';
import type winston from 'winston';
import { URI } from 'vscode-uri';

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
	 * Promises that resolve to the disposables for the dynamically registered
	 * document formatters, by resource URI.
	 */
	#registrations = new Map<string, Promise<LSP.Disposable>>();

	constructor({ context, logger }: LanguageServerModuleConstructorParameters) {
		this.#context = context;
		this.#logger = logger;
	}

	async #shouldFormat(document: TextDocument): Promise<boolean> {
		const options = await this.#context.getOptions(document.uri);

		return options.validate.includes(document.languageId);
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

	async #register(document: TextDocument): Promise<void> {
		if (
			!this.#registerDynamically ||
			!(await this.#shouldFormat(document)) ||
			this.#registrations.has(document.uri)
		) {
			return;
		}

		const { scheme, fsPath } = URI.parse(document.uri);

		const pattern = (scheme === 'file' ? fsPath.replace(/\\/g, '/') : fsPath).replace(
			/[[\]{}]/g,
			'?',
		);

		const filter: LSP.DocumentFilter = { scheme, pattern };
		const options: LSP.DocumentFormattingRegistrationOptions = { documentSelector: [filter] };

		this.#registrations.set(
			document.uri,
			this.#context.connection.client.register(LSP.DocumentFormattingRequest.type, options),
		);

		this.#logger?.debug('Registering formatter for document', { uri: document.uri, options });

		await this.#context.connection.sendNotification(
			Notification.DidRegisterDocumentFormattingEditProvider,
			{ uri: document.uri, options },
		);
	}

	#deregister(uri: string): void {
		const registration = this.#registrations.get(uri);

		if (!registration) {
			return;
		}

		this.#logger?.debug('Deregistering formatter for document', { uri });

		registration
			.then(({ dispose }) => dispose())
			.catch((error: unknown) => {
				this.#logger?.error('Error deregistering formatter for document', { uri, error });
			});

		this.#registrations.delete(uri);
	}

	#deregisterAll(): void {
		for (const [uri, registration] of this.#registrations) {
			this.#logger?.debug('Deregistering formatter for document', { uri });

			registration
				.then(({ dispose }) => dispose())
				.catch((error: unknown) => {
					this.#logger?.error('Error deregistering formatter for document', { uri, error });
				});
		}

		this.#registrations.clear();
	}

	onDidRegisterHandlers(): void {
		this.#logger?.debug('Registering connection.onDocumentFormatting handler');
		this.#context.connection.onDocumentFormatting(async ({ textDocument, options }) => {
			this.#logger?.debug('Received onDocumentFormatting', { textDocument, options });

			if (!textDocument) {
				this.#logger?.debug('No text document provided, ignoring');

				return null;
			}

			const { uri } = textDocument;
			const document = this.#context.documents.get(uri);

			if (!document || !(await this.#shouldFormat(document))) {
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
		this.#logger?.debug('connection.onDocumentFormatting handler registered');

		this.#logger?.debug('Registering documents.onDidOpen handler');
		this.#context.documents.onDidOpen(({ document }) => this.#register(document));
		this.#logger?.debug('documents.onDidOpen handler registered');

		this.#logger?.debug('Registering documents.onDidChangeContent handler');
		this.#context.documents.onDidChangeContent(({ document }) => this.#register(document));
		this.#logger?.debug('documents.onDidChangeContent handler registered');

		this.#logger?.debug('Registering documents.onDidSave handler');
		this.#context.documents.onDidSave(({ document }) => this.#register(document));
		this.#logger?.debug('documents.onDidSave handler registered');

		this.#logger?.debug('Registering documents.onDidClose handler');
		this.#context.documents.onDidClose(({ document }) => this.#deregister(document.uri));
		this.#logger?.debug('documents.onDidClose handler registered');

		this.#logger?.debug('Registering DidChangeConfigurationNotification');
		this.#context.notifications.on(LSP.DidChangeConfigurationNotification.type, () =>
			this.#deregisterAll(),
		);
		this.#logger?.debug('DidChangeConfigurationNotification registered');

		this.#logger?.debug('Registering DidChangeWorkspaceFoldersNotification');
		this.#context.notifications.on(LSP.DidChangeWorkspaceFoldersNotification.type, () =>
			this.#deregisterAll(),
		);
		this.#logger?.debug('DidChangeWorkspaceFoldersNotification registered');
	}
}
