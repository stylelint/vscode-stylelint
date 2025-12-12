import semver from 'semver';
import type { Connection } from 'vscode-languageserver';
import type LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocumentChangeEvent } from 'vscode-languageserver/node';
import type winston from 'winston';

import { inject } from '../../../di/index.js';
import { initialize, lspService, textDocumentEvent } from '../../decorators.js';
import { NormalizeFsPathToken, PathIsInsideToken, lspConnectionToken } from '../../tokens.js';
import { type LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';
import { StylelintRunnerService } from '../stylelint-runtime/stylelint-runner.service.js';
import { WorkspaceFolderService } from '../workspace/workspace-folder.service.js';
import { WorkspaceOptionsService } from '../workspace/workspace-options.service.js';

const migrationGuideUrl =
	'https://github.com/stylelint/vscode-stylelint#migrating-from-vscode-stylelint-0xstylelint-13x';

@lspService()
@inject({
	inject: [
		WorkspaceOptionsService,
		StylelintRunnerService,
		WorkspaceFolderService,
		NormalizeFsPathToken,
		PathIsInsideToken,
		lspConnectionToken,
		loggingServiceToken,
	],
})
export class OldStylelintWarningLspService {
	#options: WorkspaceOptionsService;
	#runner: StylelintRunnerService;
	#workspaceFolderService: WorkspaceFolderService;
	#normalizeFsPath: (path: string | undefined) => string | undefined;
	#pathIsInside: (child: string, parent: string) => boolean;
	#connection: Connection;
	#logger?: winston.Logger;
	#checkedWorkspaces = new Set<string>();
	#openMigrationGuide = false;

	constructor(
		options: WorkspaceOptionsService,
		runner: StylelintRunnerService,
		workspaceFolderService: WorkspaceFolderService,
		normalizeFsPath: (path: string | undefined) => string | undefined,
		pathIsInside: (child: string, parent: string) => boolean,
		connection: Connection,
		loggingService: LoggingService,
	) {
		this.#options = options;
		this.#runner = runner;
		this.#workspaceFolderService = workspaceFolderService;
		this.#normalizeFsPath = normalizeFsPath;
		this.#pathIsInside = pathIsInside;
		this.#connection = connection;
		this.#logger = loggingService.createLogger(OldStylelintWarningLspService);
	}

	@textDocumentEvent('onDidOpen')
	async handleDocumentOpened({ document }: TextDocumentChangeEvent<TextDocument>): Promise<void> {
		const stylelintVersion = await this.#check(document);

		if (stylelintVersion) {
			await this.#showWarning(stylelintVersion);
		}
	}

	@initialize()
	onInitialize(params?: LSP.InitializeParams): void {
		this.#openMigrationGuide = params?.capabilities.window?.showDocument?.support ?? false;
	}

	async #getStylelintVersion(
		document: TextDocument,
		workspaceFolder: string,
	): Promise<string | undefined> {
		const options = await this.#options.getOptions(document.uri);
		const result = await this.#runner.resolve(document, options);

		if (!result) {
			this.#logger?.debug('Stylelint not found', { uri: document.uri });

			return undefined;
		}

		const normalizedPackageDir = this.#normalizeFsPath(result.resolvedPath);
		const normalizedWorkspaceFolder = this.#normalizeFsPath(workspaceFolder);

		if (
			normalizedPackageDir &&
			normalizedWorkspaceFolder &&
			!this.#pathIsInside(normalizedPackageDir, normalizedWorkspaceFolder)
		) {
			this.#logger?.debug('Stylelint package root is not inside the workspace', {
				uri: document.uri,
			});

			return undefined;
		}

		if (!result.version) {
			this.#logger?.debug('Stylelint version not available from worker', {
				uri: document.uri,
			});

			return undefined;
		}

		return result.version;
	}

	async #check(document: TextDocument): Promise<string | undefined> {
		const workspaceFolder = await this.#workspaceFolderService.getWorkspaceFolder(
			this.#connection,
			document,
		);

		if (!workspaceFolder) {
			this.#logger?.debug('Document not part of a workspace, ignoring', {
				uri: document.uri,
			});

			return undefined;
		}

		if (this.#checkedWorkspaces.has(workspaceFolder)) {
			this.#logger?.debug('Workspace already checked, ignoring', {
				uri: document.uri,
			});

			return undefined;
		}

		this.#checkedWorkspaces.add(workspaceFolder);

		const stylelintVersion = await this.#getStylelintVersion(document, workspaceFolder);

		if (!stylelintVersion) {
			return undefined;
		}

		try {
			const coerced = semver.coerce(stylelintVersion);

			if (!coerced) {
				throw new Error(`Could not coerce version "${stylelintVersion}"`);
			}

			return semver.lt(coerced, '14.0.0') ? stylelintVersion : undefined;
		} catch (error) {
			this.#logger?.debug('Stylelint version could not be parsed', {
				uri: document.uri,
				version: stylelintVersion,
				error,
			});

			return undefined;
		}
	}

	async #showWarning(stylelintVersion: string): Promise<void> {
		this.#logger?.warn(`Found unsupported version of Stylelint: ${stylelintVersion}`);

		const message = `Stylelint version ${stylelintVersion} is no longer supported. While it may continue to work for a while, you may encounter unexpected behavior. Please upgrade to version 14.0.0 or newer. See the migration guide for more information.`;

		if (!this.#openMigrationGuide) {
			this.#connection.window.showWarningMessage(message);

			return;
		}

		const warningResponse = await this.#connection.window.showWarningMessage(message, {
			title: 'Open migration guide',
		});

		if (warningResponse?.title === 'Open migration guide') {
			const showDocumentResponse = await this.#connection.window.showDocument({
				uri: migrationGuideUrl,
				external: true,
			});

			if (!showDocumentResponse.success) {
				this.#logger?.warn('Failed to open migration guide');
			}
		}
	}
}
