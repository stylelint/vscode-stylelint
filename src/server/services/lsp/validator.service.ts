import type { Connection } from 'vscode-languageserver';
import {
	DidChangeConfigurationNotification,
	DidChangeWatchedFilesNotification,
} from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocumentChangeEvent, TextDocuments } from 'vscode-languageserver/node';
import type winston from 'winston';
import { inject } from '../../../di/index.js';
import { displayError } from '../../utils/index.js';
import { initialize, lspService, notification, textDocumentEvent } from '../../decorators.js';
import type { LintDiagnostics } from '../../stylelint/index.js';
import { lspConnectionToken, textDocumentsToken } from '../../tokens.js';
import { DocumentDiagnosticsService } from '../documents/document-diagnostics.service.js';
import { type LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';
import { StylelintRunnerService } from '../stylelint-runtime/stylelint-runner.service.js';
import { WorkspaceOptionsService } from '../workspace/workspace-options.service.js';

@lspService()
@inject({
	inject: [
		textDocumentsToken,
		WorkspaceOptionsService,
		DocumentDiagnosticsService,
		StylelintRunnerService,
		lspConnectionToken,
		loggingServiceToken,
	],
})
export class ValidatorLspService {
	#documents: TextDocuments<TextDocument>;
	#options: WorkspaceOptionsService;
	#diagnostics: DocumentDiagnosticsService;
	#runner: StylelintRunnerService;
	#connection: Connection;
	#logger?: winston.Logger;

	constructor(
		documents: TextDocuments<TextDocument>,
		options: WorkspaceOptionsService,
		diagnostics: DocumentDiagnosticsService,
		runner: StylelintRunnerService,
		connection: Connection,
		loggingService: LoggingService,
	) {
		this.#documents = documents;
		this.#options = options;
		this.#diagnostics = diagnostics;
		this.#runner = runner;
		this.#connection = connection;
		this.#logger = loggingService.createLogger(ValidatorLspService);
	}

	@initialize()
	onInitialize(): void {
		void this.#validateAll();
	}

	@textDocumentEvent('onDidChangeContent')
	async handleDocumentChanged({ document }: TextDocumentChangeEvent<TextDocument>): Promise<void> {
		await this.#validate(document);
	}

	@textDocumentEvent('onDidClose')
	async handleDocumentClosed({ document }: TextDocumentChangeEvent<TextDocument>): Promise<void> {
		await this.#clearDiagnostics(document);
	}

	async #shouldValidate(document: TextDocument): Promise<boolean> {
		const options = await this.#options.getOptions(document.uri);

		return options.validate.includes(document.languageId);
	}

	async #validate(document: TextDocument): Promise<void> {
		if (!(await this.#shouldValidate(document))) {
			if (this.#diagnostics.getDiagnostics(document.uri).length > 0) {
				this.#logger?.debug('Document should not be validated, clearing diagnostics', {
					uri: document.uri,
					language: document.languageId,
				});
				await this.#clearDiagnostics(document);
			} else {
				this.#logger?.debug('Document should not be validated, ignoring', {
					uri: document.uri,
					language: document.languageId,
				});
			}

			return;
		}

		const result = await this.#lintDocument(document);

		if (!result) {
			this.#logger?.debug('No lint result, ignoring', { uri: document.uri });

			return;
		}

		this.#logger?.debug('Sending diagnostics', {
			uri: document.uri,
			diagnostics: result.diagnostics,
		});

		try {
			await this.#connection.sendDiagnostics({
				uri: document.uri,
				diagnostics: result.diagnostics,
			});
			this.#diagnostics.set(document, result.diagnostics, result);
			this.#logger?.debug('Diagnostics sent', { uri: document.uri });
		} catch (error) {
			displayError(this.#connection, error);
			this.#logger?.error('Failed to send diagnostics', {
				uri: document.uri,
				error,
			});
		}
	}

	async #lintDocument(document: TextDocument): Promise<LintDiagnostics | undefined> {
		this.#logger?.debug('Linting document', { uri: document.uri });

		try {
			const options = await this.#options.getOptions(document.uri);
			const results = await this.#runner.lintDocument(document, {}, options);

			return results;
		} catch (error) {
			displayError(this.#connection, error);
			this.#logger?.error('Error running lint', { uri: document.uri, error });

			return undefined;
		}
	}

	@notification(DidChangeWatchedFilesNotification.type)
	@notification(DidChangeConfigurationNotification.type)
	async #validateAll(): Promise<void> {
		await Promise.allSettled(this.#documents.all().map((document) => this.#validate(document)));
	}

	async #clearDiagnostics(document: TextDocument): Promise<void> {
		this.#logger?.debug('Clearing diagnostics for document', { uri: document.uri });
		this.#diagnostics.clear(document.uri);
		await this.#connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
	}
}
