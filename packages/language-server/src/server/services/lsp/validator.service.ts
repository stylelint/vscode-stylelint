import type { Connection, TextDocumentChangeEvent, TextDocuments } from 'vscode-languageserver';
import LSP, {
	DidChangeConfigurationNotification,
	DidChangeWatchedFilesNotification,
} from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import type winston from 'winston';
import { inject } from '../../../di/index.js';
import { displayError } from '../../utils/index.js';
import {
	command,
	initialize,
	lspService,
	notification,
	textDocumentEvent,
} from '../../decorators.js';
import type { LintDiagnostics } from '../../stylelint/index.js';
import { lspConnectionToken, textDocumentsToken, UriModuleToken } from '../../tokens.js';
import { CommandId, Status, StatusNotification } from '../../types.js';
import { StylelintRequestCancelledError } from '../../worker/worker-process.js';
import { DocumentDiagnosticsService } from '../documents/document-diagnostics.service.js';
import { type LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';
import { StylelintRunnerService } from '../stylelint-runtime/stylelint-runner.service.js';
import { WorkspaceOptionsService } from '../workspace/workspace-options.service.js';

/**
 * Default delay, in milliseconds, before a document change triggers validation.
 * This prevents redundant lint cycles during rapid typing.
 */
const validationDebounceDelay = 300;

@lspService()
@inject({
	inject: [
		textDocumentsToken,
		WorkspaceOptionsService,
		DocumentDiagnosticsService,
		StylelintRunnerService,
		lspConnectionToken,
		loggingServiceToken,
		UriModuleToken,
	],
})
export class ValidatorLspService {
	#documents: TextDocuments<TextDocument>;
	#options: WorkspaceOptionsService;
	#diagnostics: DocumentDiagnosticsService;
	#runner: StylelintRunnerService;
	#connection: Connection;
	#logger?: winston.Logger;
	#uri: typeof URI;
	#publishedUris = new Set<string>();
	#debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
	#pendingValidations = new Map<string, Promise<void>>();
	#abortControllers = new Map<string, AbortController>();

	constructor(
		documents: TextDocuments<TextDocument>,
		options: WorkspaceOptionsService,
		diagnostics: DocumentDiagnosticsService,
		runner: StylelintRunnerService,
		connection: Connection,
		loggingService: LoggingService,
		uriModule: typeof URI,
	) {
		this.#documents = documents;
		this.#options = options;
		this.#diagnostics = diagnostics;
		this.#runner = runner;
		this.#connection = connection;
		this.#logger = loggingService.createLogger(ValidatorLspService);
		this.#uri = uriModule;
	}

	@initialize()
	onInitialize(): Partial<LSP.InitializeResult> {
		void this.#validateAll();

		return {
			capabilities: {
				executeCommandProvider: {
					commands: [CommandId.LintFiles, CommandId.ClearAllProblems],
				},
			},
		};
	}

	@textDocumentEvent('onDidOpen')
	async handleDocumentOpened({ document }: TextDocumentChangeEvent<TextDocument>): Promise<void> {
		await this.#validate(document);
	}

	@textDocumentEvent('onDidChangeContent')
	async handleDocumentChanged({ document }: TextDocumentChangeEvent<TextDocument>): Promise<void> {
		const options = await this.#options.getOptions(document.uri);

		if (options.run === 'onType') {
			await this.#validateDebounced(document);
		}
	}

	@textDocumentEvent('onDidSave')
	async handleDocumentSaved({ document }: TextDocumentChangeEvent<TextDocument>): Promise<void> {
		const options = await this.#options.getOptions(document.uri);

		if (options.run === 'onSave') {
			await this.#validate(document);
		}
	}

	@textDocumentEvent('onDidClose')
	async handleDocumentClosed({ document }: TextDocumentChangeEvent<TextDocument>): Promise<void> {
		this.#cancelPendingValidation(document.uri);
		await this.#clearDiagnostics(document);
	}

	async #shouldValidate(document: TextDocument): Promise<boolean> {
		const options = await this.#options.getOptions(document.uri);

		return options.validate.includes(document.languageId);
	}

	/**
	 * Schedules a debounced validation for the document. If a previous
	 * debounce timer exists for the same URI it is cancelled first, so only
	 * the latest edit triggers a lint.
	 */
	#validateDebounced(document: TextDocument): Promise<void> {
		return new Promise<void>((resolve) => {
			this.#cancelPendingValidation(document.uri);

			const timer = setTimeout(() => {
				this.#debounceTimers.delete(document.uri);

				const validation = this.#validate(document).finally(() => {
					this.#pendingValidations.delete(document.uri);
				});

				this.#pendingValidations.set(document.uri, validation);
				validation.then(resolve, resolve);
			}, validationDebounceDelay);

			this.#debounceTimers.set(document.uri, timer);
		});
	}

	#cancelPendingValidation(uri: string): void {
		const timer = this.#debounceTimers.get(uri);

		if (timer) {
			clearTimeout(timer);
			this.#debounceTimers.delete(uri);
		}

		this.#abortValidation(uri);
	}

	#abortValidation(uri: string): void {
		const controller = this.#abortControllers.get(uri);

		if (controller) {
			controller.abort();
			this.#abortControllers.delete(uri);
		}
	}

	async #validate(document: TextDocument): Promise<void> {
		this.#abortValidation(document.uri);

		const controller = new AbortController();

		this.#abortControllers.set(document.uri, controller);

		const versionBefore = document.version;

		try {
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

			const result = await this.#lintDocument(document, controller.signal);

			if (!result) {
				this.#logger?.debug('No lint result, ignoring', { uri: document.uri });

				return;
			}

			// If the document was edited while the lint was running, discard the
			// stale result. A new validation will be triggered by the edit.
			const currentDocument = this.#documents.get(document.uri);

			if (currentDocument && currentDocument.version !== versionBefore) {
				this.#logger?.debug('Discarding stale lint result', {
					uri: document.uri,
					lintedVersion: versionBefore,
					currentVersion: currentDocument.version,
				});

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
				this.#publishedUris.add(document.uri);
				this.#logger?.debug('Diagnostics sent', { uri: document.uri });
				this.#sendStatusNotification(document.uri, Status.ok);
			} catch (error) {
				displayError(this.#connection, error);
				this.#logger?.error('Failed to send diagnostics', {
					uri: document.uri,
					error,
				});
				this.#sendStatusNotification(document.uri, Status.error);
			}
		} finally {
			if (this.#abortControllers.get(document.uri) === controller) {
				this.#abortControllers.delete(document.uri);
			}
		}
	}

	async #lintDocument(
		document: TextDocument,
		signal?: AbortSignal,
	): Promise<LintDiagnostics | undefined> {
		this.#logger?.debug('Linting document', { uri: document.uri });

		try {
			const options = await this.#options.getOptions(document.uri);
			const results = await this.#runner.lintDocument(document, {}, options, signal);

			return results;
		} catch (error) {
			if (error instanceof StylelintRequestCancelledError) {
				this.#logger?.debug('Lint cancelled', { uri: document.uri });

				return undefined;
			}

			displayError(this.#connection, error);
			this.#logger?.error('Error running lint', { uri: document.uri, error });
			this.#sendStatusNotification(document.uri, Status.error);

			return undefined;
		}
	}

	#sendStatusNotification(uri: string, state: Status): void {
		this.#connection.sendNotification(StatusNotification, { uri, state }).catch(() => {
			// Best effort, ignore any errors since it's non-critical.
		});
	}

	@notification(DidChangeWatchedFilesNotification.type)
	@notification(DidChangeConfigurationNotification.type)
	async #validateAll(): Promise<void> {
		await Promise.allSettled(this.#documents.all().map((document) => this.#validate(document)));
	}

	@command(CommandId.ClearAllProblems)
	async clearAllProblems(): Promise<void> {
		for (const timer of this.#debounceTimers.values()) {
			clearTimeout(timer);
		}

		this.#debounceTimers.clear();

		for (const controller of this.#abortControllers.values()) {
			controller.abort();
		}

		this.#abortControllers.clear();

		for (const uri of this.#publishedUris) {
			this.#diagnostics.clear(uri);
			await this.#connection.sendDiagnostics({ uri, diagnostics: [] });
		}

		this.#publishedUris.clear();
		this.#logger?.info('Cleared all diagnostics');
	}

	@command(CommandId.LintFiles)
	async lintFiles(workspaceFolderUri?: string): Promise<void> {
		if (workspaceFolderUri) {
			await this.#lintFolder(workspaceFolderUri);

			return;
		}

		const workspaceFolders = await this.#connection.workspace.getWorkspaceFolders();

		if (!workspaceFolders || workspaceFolders.length === 0) {
			this.#logger?.warn('No workspace folders found');

			return;
		}

		await Promise.all(workspaceFolders.map((folder) => this.#lintFolder(folder.uri)));
	}

	async #lintFolder(workspaceFolderUri: string): Promise<void> {
		const { fsPath } = this.#uri.parse(workspaceFolderUri);

		if (!fsPath) {
			this.#logger?.warn('Invalid workspace folder URI', { workspaceFolderUri });

			return;
		}

		this.#logger?.info('Linting workspace folder', { workspaceFolderUri, fsPath });

		try {
			const extensionOptions = await this.#options.getOptions(workspaceFolderUri);

			const multiFileDiagnostics = await this.#runner.lintWorkspaceFolder(fsPath, {
				...extensionOptions,
				config: extensionOptions.config ?? undefined,
				lintFilesGlob: extensionOptions.lintFiles.glob,
			});

			for (const [filePath, lintDiagnostics] of multiFileDiagnostics) {
				const fileUri = this.#uri.file(filePath).toString();

				await this.#connection.sendDiagnostics({
					uri: fileUri,
					diagnostics: lintDiagnostics.diagnostics,
				});

				this.#publishedUris.add(fileUri);

				const openDocument = this.#documents.get(fileUri);

				if (openDocument) {
					this.#diagnostics.set(openDocument, lintDiagnostics.diagnostics, lintDiagnostics);
				}
			}

			this.#logger?.info('Workspace folder linting complete', {
				workspaceFolderUri,
				fileCount: multiFileDiagnostics.size,
			});
		} catch (error) {
			displayError(this.#connection, error);
			this.#logger?.error('Error linting workspace folder', { workspaceFolderUri, error });
		}
	}

	async #clearDiagnostics(document: TextDocument): Promise<void> {
		this.#logger?.debug('Clearing diagnostics for document', { uri: document.uri });
		this.#diagnostics.clear(document.uri);
		this.#publishedUris.delete(document.uri);
		await this.#connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
	}
}
