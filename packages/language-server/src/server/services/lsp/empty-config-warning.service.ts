import type { Connection, TextDocumentChangeEvent } from 'vscode-languageserver';
import type LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type winston from 'winston';

import { inject } from '../../../di/index.js';
import { initialize, lspService, textDocumentEvent } from '../../decorators.js';
import { lspConnectionToken } from '../../tokens.js';
import { isEmptyObject } from '../../utils/index.js';
import { type LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';
import { WorkspaceFolderService } from '../workspace/workspace-folder.service.js';
import { WorkspaceOptionsService } from '../workspace/workspace-options.service.js';

/**
 * Service that warns users when the `stylelint.config` setting is set to an
 * empty object (`{}`), which overrides config file lookup and may cause
 * confusing "No rules found" errors.
 */
@lspService()
@inject({
	inject: [
		WorkspaceOptionsService,
		WorkspaceFolderService,
		lspConnectionToken,
		loggingServiceToken,
	],
})
export class EmptyConfigWarningLspService {
	#options: WorkspaceOptionsService;
	#workspaceFolderService: WorkspaceFolderService;
	#connection: Connection;
	#logger?: winston.Logger;
	#warnedWorkspaces = new Set<string>();
	#isVSCode = false;
	#canShowDocument = false;

	constructor(
		options: WorkspaceOptionsService,
		workspaceFolderService: WorkspaceFolderService,
		connection: Connection,
		loggingService: LoggingService,
	) {
		this.#options = options;
		this.#workspaceFolderService = workspaceFolderService;
		this.#connection = connection;
		this.#logger = loggingService.createLogger(EmptyConfigWarningLspService);
	}

	@textDocumentEvent('onDidOpen')
	async handleDocumentOpened({ document }: TextDocumentChangeEvent<TextDocument>): Promise<void> {
		const hasEmptyConfig = await this.#check(document);

		if (hasEmptyConfig) {
			await this.#showWarning();
		}
	}

	@initialize()
	onInitialize(params?: LSP.InitializeParams): void {
		this.#isVSCode = params?.clientInfo?.name === 'Visual Studio Code';
		this.#canShowDocument = params?.capabilities.window?.showDocument?.support ?? false;
	}

	async #check(document: TextDocument): Promise<boolean> {
		const workspaceFolder = await this.#workspaceFolderService.getWorkspaceFolder(
			this.#connection,
			document,
		);

		if (!workspaceFolder) {
			this.#logger?.debug('Document not part of a workspace, ignoring', {
				uri: document.uri,
			});

			return false;
		}

		if (this.#warnedWorkspaces.has(workspaceFolder)) {
			this.#logger?.debug('Already warned about empty config in this workspace', {
				uri: document.uri,
			});

			return false;
		}

		const options = await this.#options.getOptions(document.uri);

		if (!isEmptyObject(options.config)) {
			this.#logger?.debug('Config is not an empty object', {
				uri: document.uri,
				configType: typeof options.config,
				configIsNull: options.config === null,
			});

			return false;
		}

		this.#warnedWorkspaces.add(workspaceFolder);
		this.#logger?.debug('Detected empty config object', { uri: document.uri });

		return true;
	}

	async #showWarning(): Promise<void> {
		this.#logger?.warn(
			'The "stylelint.config" setting is set to an empty object, overriding config file lookup',
		);

		const message =
			'The "stylelint.config" setting is set to an empty object ({}). This overrides config file lookup and may cause "No rules found" errors. Remove this setting from User, Remote, or Workspace settings to let Stylelint find your configuration file.';

		if (!this.#isVSCode || !this.#canShowDocument) {
			this.#connection.window.showWarningMessage(message);

			return;
		}

		const warningResponse = await this.#connection.window.showWarningMessage(message, {
			title: 'Open Settings',
		});

		if (warningResponse?.title === 'Open Settings') {
			const showDocumentResponse = await this.#connection.window.showDocument({
				uri: 'vscode://settings/stylelint.config',
				external: true,
			});

			if (!showDocumentResponse.success) {
				this.#logger?.warn('Failed to open VS Code settings');
			}
		}
	}
}
