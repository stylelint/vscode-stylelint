import type { Connection, Disposable } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocumentChangeEvent, TextDocuments } from 'vscode-languageserver/node';
import type winston from 'winston';

import type { URI } from 'vscode-uri';
import { inject } from '../../../di/index.js';
import {
	documentFormattingRequest,
	initialize,
	lspService,
	notification,
	shutdown,
	textDocumentEvent,
} from '../../decorators.js';
import { formattingOptionsToRules } from '../../stylelint/index.js';
import { lspConnectionToken, textDocumentsToken, UriModuleToken } from '../../tokens.js';
import { Notification } from '../../types.js';
import { DocumentFixesService } from '../documents/document-fixes.service.js';
import { type LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';
import { WorkspaceOptionsService } from '../workspace/workspace-options.service.js';

@lspService()
@inject({
	inject: [
		textDocumentsToken,
		WorkspaceOptionsService,
		DocumentFixesService,
		lspConnectionToken,
		UriModuleToken,
		loggingServiceToken,
	],
})
export class FormatterLspService {
	#documents: TextDocuments<TextDocument>;
	#options: WorkspaceOptionsService;
	#fixes: DocumentFixesService;
	#connection: Connection;
	#uri: Pick<typeof URI, 'parse'>;
	#logger?: winston.Logger;
	#registerDynamically = false;
	#registrations = new Map<string, Promise<Disposable>>();

	constructor(
		documents: TextDocuments<TextDocument>,
		options: WorkspaceOptionsService,
		fixes: DocumentFixesService,
		connection: Connection,
		uriModule: Pick<typeof URI, 'parse'>,
		loggingService: LoggingService,
	) {
		this.#documents = documents;
		this.#options = options;
		this.#fixes = fixes;
		this.#connection = connection;
		this.#uri = uriModule;
		this.#logger = loggingService.createLogger(FormatterLspService);
	}

	@initialize()
	onInitialize(params?: LSP.InitializeParams): Partial<LSP.InitializeResult> | void {
		this.#registerDynamically = Boolean(
			params?.capabilities.textDocument?.formatting?.dynamicRegistration,
		);

		return {
			capabilities: {
				documentFormattingProvider: !this.#registerDynamically,
			},
		};
	}

	@textDocumentEvent('onDidOpen')
	@textDocumentEvent('onDidChangeContent')
	@textDocumentEvent('onDidSave')
	async handleDocumentRegistration({
		document,
	}: TextDocumentChangeEvent<TextDocument>): Promise<void> {
		await this.#register(document);
	}

	@textDocumentEvent('onDidClose')
	handleDocumentClosed({ document }: TextDocumentChangeEvent<TextDocument>): void {
		this.#deregister(document.uri);
	}

	async #shouldFormat(document: TextDocument): Promise<boolean> {
		const options = await this.#options.getOptions(document.uri);

		return options.validate.includes(document.languageId);
	}

	async #register(document: TextDocument): Promise<void> {
		if (
			!this.#registerDynamically ||
			!(await this.#shouldFormat(document)) ||
			this.#registrations.has(document.uri)
		) {
			return;
		}

		const parsedUri = this.#uri.parse(document.uri);
		const basePath =
			parsedUri.scheme === 'file'
				? (parsedUri.fsPath ?? parsedUri.path ?? '')
				: (parsedUri.path ?? parsedUri.fsPath ?? '');
		const normalizedPath = basePath.replace(/\\/g, '/').replace(/[[\]{}]/g, '?');
		const filter: LSP.DocumentFilter = { scheme: parsedUri.scheme, pattern: normalizedPath };
		const options: LSP.DocumentFormattingRegistrationOptions = {
			documentSelector: [filter],
		};

		this.#registrations.set(
			document.uri,
			this.#connection.client.register(LSP.DocumentFormattingRequest.type, options),
		);

		this.#logger?.debug('Registering formatter for document', {
			uri: document.uri,
			options,
		});

		await this.#connection.sendNotification(
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
			.then((disposable) => disposable.dispose())
			.catch((error: unknown) => {
				this.#logger?.error('Error deregistering formatter for document', {
					uri,
					error,
				});
			});

		this.#registrations.delete(uri);
	}

	@notification(LSP.DidChangeConfigurationNotification.type)
	@notification(LSP.DidChangeWorkspaceFoldersNotification.type)
	@shutdown()
	deregisterAll(): void {
		for (const [uri, registration] of this.#registrations) {
			registration
				.then((disposable) => disposable.dispose())
				.catch((error: unknown) => {
					this.#logger?.error('Error deregistering formatter for document', {
						uri,
						error,
					});
				});
		}

		this.#registrations.clear();
	}

	@documentFormattingRequest()
	async handleDocumentFormatting(
		params: LSP.DocumentFormattingParams,
	): Promise<LSP.TextEdit[] | undefined | null> {
		this.#logger?.debug('Received onDocumentFormatting', params);

		const { textDocument, options } = params;

		if (!textDocument) {
			this.#logger?.debug('No text document provided, ignoring');

			return null;
		}

		const { uri } = textDocument;
		const document = this.#documents.get(uri);

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

		const fixes = await this.#fixes.getFixes(document, linterOptions);

		this.#logger?.debug('Returning fixes', { uri, fixes });

		return fixes;
	}
}
