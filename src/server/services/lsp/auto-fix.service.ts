import type { Connection } from 'vscode-languageserver';
import { WorkspaceChange, type default as LSP } from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocuments } from 'vscode-languageserver/node';
import type winston from 'winston';
import { inject } from '../../../di/index.js';
import { command, initialize, lspService } from '../../decorators.js';
import { lspConnectionToken, textDocumentsToken } from '../../tokens.js';
import { CommandId } from '../../types.js';
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
		loggingServiceToken,
	],
})
export class AutoFixService {
	#documents: TextDocuments<TextDocument>;
	#options: WorkspaceOptionsService;
	#fixes: DocumentFixesService;
	#connection: Connection;

	/**
	 * The logger to use.
	 */
	#logger: winston.Logger;

	constructor(
		documents: TextDocuments<TextDocument>,
		options: WorkspaceOptionsService,
		fixes: DocumentFixesService,
		connection: Connection,
		loggingService: LoggingService,
	) {
		this.#documents = documents;
		this.#options = options;
		this.#fixes = fixes;
		this.#connection = connection;
		this.#logger = loggingService.createLogger(AutoFixService);
	}

	async #shouldAutoFix(document: TextDocument): Promise<boolean> {
		const options = await this.#options.getOptions(document.uri);

		return options.validate.includes(document.languageId);
	}

	@initialize()
	onInitialize(): Partial<LSP.InitializeResult> | void {
		return {
			capabilities: {
				executeCommandProvider: {
					commands: [CommandId.ApplyAutoFix],
				},
			},
		};
	}

	@command(CommandId.ApplyAutoFix, { minArgs: 1 })
	async applyAutoFix(identifier: { version: number; uri: string }): Promise<void> {
		const uri = identifier.uri;
		const document = this.#documents.get(uri);

		if (!document || !(await this.#shouldAutoFix(document))) {
			if (this.#logger?.isDebugEnabled()) {
				if (!document) {
					this.#logger.debug('Unknown document, ignoring', { uri });
				} else {
					this.#logger.debug('Document should not be auto-fixed, ignoring', {
						uri,
						language: document.languageId,
					});
				}
			}

			return;
		}

		if (identifier.version !== document.version) {
			this.#logger?.debug('Document has been modified, ignoring', {
				uri,
			});

			return;
		}

		const workspaceChange = new WorkspaceChange();
		const textChange = workspaceChange.getTextEditChange(identifier);

		const edits = await this.#fixes.getFixes(document);

		edits.forEach((edit) => textChange.add(edit));

		this.#logger?.debug('Applying fixes', { uri, edits });

		try {
			const response = await this.#connection.workspace.applyEdit(workspaceChange.edit);

			if (!response.applied) {
				this.#logger?.debug('Failed to apply fixes', { uri, response });
			}
		} catch (error) {
			this.#logger?.debug('Failed to apply fixes', { uri, error });
		}
	}
}
