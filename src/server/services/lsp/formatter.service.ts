import semver from 'semver';
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
import { StylelintRunnerService } from '../stylelint-runtime/stylelint-runner.service.js';
import { WorkspaceOptionsService } from '../workspace/workspace-options.service.js';

const formattingDocUrl = 'https://github.com/stylelint/vscode-stylelint#document-formatting';

@lspService()
@inject({
	inject: [
		textDocumentsToken,
		WorkspaceOptionsService,
		DocumentFixesService,
		StylelintRunnerService,
		lspConnectionToken,
		UriModuleToken,
		loggingServiceToken,
	],
})
export class FormatterLspService {
	#documents: TextDocuments<TextDocument>;
	#options: WorkspaceOptionsService;
	#fixes: DocumentFixesService;
	#runner: StylelintRunnerService;
	#connection: Connection;
	#uri: Pick<typeof URI, 'parse'>;
	#logger?: winston.Logger;
	#registerDynamically = false;
	#openDocumentationLinks = false;
	#registrations = new Map<string, Promise<Disposable>>();
	#warnedDocuments = new Set<string>();

	constructor(
		documents: TextDocuments<TextDocument>,
		options: WorkspaceOptionsService,
		fixes: DocumentFixesService,
		runner: StylelintRunnerService,
		connection: Connection,
		uriModule: Pick<typeof URI, 'parse'>,
		loggingService: LoggingService,
	) {
		this.#documents = documents;
		this.#options = options;
		this.#fixes = fixes;
		this.#runner = runner;
		this.#connection = connection;
		this.#uri = uriModule;
		this.#logger = loggingService.createLogger(FormatterLspService);
	}

	@initialize()
	onInitialize(params?: LSP.InitializeParams): Partial<LSP.InitializeResult> | void {
		this.#registerDynamically = Boolean(
			params?.capabilities.textDocument?.formatting?.dynamicRegistration,
		);
		this.#openDocumentationLinks = params?.capabilities.window?.showDocument?.support ?? false;

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

	/**
	 * Checks if the resolved Stylelint version is 16 or newer, which removed
	 * stylistic formatting rules. Returns the version string if 16+, otherwise
	 * undefined.
	 */
	async #checkStylelint16OrNewer(document: TextDocument): Promise<string | undefined> {
		try {
			const runnerOptions = await this.#options.getOptions(document.uri);
			const resolution = await this.#runner.resolve(document, runnerOptions);

			if (!resolution?.version) {
				this.#logger?.debug('Stylelint version not available', { uri: document.uri });

				return undefined;
			}

			const coerced = semver.coerce(resolution.version);

			if (!coerced) {
				this.#logger?.debug('Could not parse Stylelint version', {
					uri: document.uri,
					version: resolution.version,
				});

				return undefined;
			}

			if (semver.gte(coerced, '16.0.0')) {
				this.#logger?.debug('Stylelint 16+ detected, formatting not available', {
					uri: document.uri,
					version: resolution.version,
				});

				return resolution.version;
			}

			return undefined;
		} catch (error) {
			this.#logger?.debug('Error checking Stylelint version', {
				uri: document.uri,
				error,
			});

			return undefined;
		}
	}

	/**
	 * Shows an informational message to the user explaining that formatting
	 * is not available with Stylelint 16+.
	 */
	#showStylelint16FormattingMessage(uri: string, version: string): void {
		// Only warn once per document to avoid spamming the user.
		if (this.#warnedDocuments.has(uri)) {
			return;
		}

		this.#warnedDocuments.add(uri);

		const message = `Stylelint ${version} doesn't include stylistic rules, so document formatting isn't available. Use "Fix all auto-fixable problems" instead.`;

		this.#logger?.info(message, { uri });

		if (!this.#openDocumentationLinks) {
			this.#connection.window.showInformationMessage(message);

			return;
		}

		// Void is used to avoid blocking the formatting response on user
		// interaction with the message.
		void this.#connection.window
			.showInformationMessage(message, { title: 'Learn more' })
			.then(async (response) => {
				if (response?.title !== 'Learn more') {
					return;
				}

				const showDocumentResponse = await this.#connection.window.showDocument({
					uri: formattingDocUrl,
					external: true,
				});

				if (!showDocumentResponse.success) {
					this.#logger?.warn('Failed to open formatting documentation');
				}
			});
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

		// Check for Stylelint 16+ which removed stylistic formatting rules
		const stylelint16Version = await this.#checkStylelint16OrNewer(document);

		if (stylelint16Version) {
			this.#showStylelint16FormattingMessage(uri, stylelint16Version);

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
