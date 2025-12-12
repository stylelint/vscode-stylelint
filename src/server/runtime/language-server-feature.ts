import type { Connection, Disposable } from 'vscode-languageserver';
import type * as LSP from 'vscode-languageserver-protocol';
import {
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
} from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocuments } from 'vscode-languageserver/node';

import type { RuntimeContext, RuntimeFeature } from '../../di/index.js';
import { isLanguageServerServiceInstance } from '../decorators.js';
import {
	CommandService,
	NotificationService,
	StylelintRunnerService,
	WorkspaceOptionsService,
} from '../services/index.js';
import { textDocumentsToken } from '../tokens.js';
import { mergeAssign } from '../utils/index.js';
import {
	LanguageServerServiceRuntime,
	type LanguageServerServiceRuntimeOptions,
} from './lsp-service-runtime.js';

export interface LanguageServerFeatureOptions {
	connection: Connection;
	runtimeFactory?: LanguageServerServiceRuntimeFactory;
}

export type LanguageServerServiceRuntimeFactory = (
	commandService: CommandService,
	options: LanguageServerServiceRuntimeOptions,
) => LanguageServerServiceRuntime;

const defaultRuntimeFactory: LanguageServerServiceRuntimeFactory = (commandService, options) =>
	new LanguageServerServiceRuntime(commandService, options);

class LanguageServerFeature implements RuntimeFeature {
	readonly #connection: Connection;
	readonly #documentDisposables: Disposable[] = [];
	readonly #runtimeFactory: LanguageServerServiceRuntimeFactory;
	#documents?: TextDocuments<TextDocument>;
	#commandService?: CommandService;
	#notificationService?: NotificationService;
	#optionsService?: WorkspaceOptionsService;
	#runner?: StylelintRunnerService;
	#serviceRuntime?: LanguageServerServiceRuntime;
	#supportsWorkspaceConfiguration = false;

	constructor(connection: Connection, runtimeFactory: LanguageServerServiceRuntimeFactory) {
		this.#connection = connection;
		this.#runtimeFactory = runtimeFactory;
	}

	start(context: RuntimeContext): void {
		if (this.#serviceRuntime) {
			return;
		}

		this.#documents = context.resolve(textDocumentsToken);
		this.#commandService = context.resolve(CommandService);
		this.#notificationService = context.resolve(NotificationService);
		this.#optionsService = context.resolve(WorkspaceOptionsService);
		this.#runner = context.resolve(StylelintRunnerService);

		this.#serviceRuntime = this.#runtimeFactory(this.#commandService, {
			documents: this.#documents,
		});

		this.#documents.listen(this.#connection);
		this.#commandService.register();

		this.#registerDocumentHandlers();
		this.#registerConnectionHandlers();
		this.#registerServices(context.metadata.services);
		this.#serviceRuntime.registerCommandHandlers();
	}

	shutdown(): void {
		if (!this.#serviceRuntime) {
			return;
		}

		this.#serviceRuntime.dispose();
		this.#serviceRuntime = undefined;

		this.#disposeDocumentHandlers();

		if (this.#commandService) {
			this.#commandService.dispose();
			this.#commandService = undefined;
		}

		if (this.#notificationService) {
			this.#notificationService.dispose();
			this.#notificationService = undefined;
		}

		try {
			this.#runner?.dispose();
		} catch {
			// Ignore resolution issues during shutdown.
		}

		this.#runner = undefined;
	}

	dispose(): void {
		this.#disposeDocumentHandlers();
	}

	#registerServices(services: readonly object[]): void {
		if (!this.#serviceRuntime) {
			return;
		}

		for (const service of services) {
			if (!isLanguageServerServiceInstance(service)) {
				continue;
			}

			this.#serviceRuntime.registerService(service);
		}
	}

	#registerDocumentHandlers(): void {
		if (!this.#documents || !this.#optionsService) {
			return;
		}

		const disposable = this.#documents.onDidClose(({ document }) => {
			this.#optionsService?.delete(document.uri);
		});

		this.#documentDisposables.push(disposable);
	}

	#disposeDocumentHandlers(): void {
		for (const disposable of this.#documentDisposables) {
			try {
				disposable.dispose();
			} catch {
				// Best-effort cleanup.
			}
		}

		this.#documentDisposables.length = 0;
	}

	#registerConnectionHandlers(): void {
		this.#connection.onInitialize((params) => this.#handleInitialize(params));
		this.#connection.onInitialized((params) => {
			void this.#handleInitialized(params);
		});
		this.#connection.onDidChangeConfiguration((params) =>
			this.#handleDidChangeConfiguration(params),
		);
	}

	#handleInitialize(params: LSP.InitializeParams): LSP.InitializeResult {
		this.#supportsWorkspaceConfiguration = Boolean(params.capabilities.workspace?.configuration);
		this.#optionsService?.setSupportsWorkspaceConfiguration(this.#supportsWorkspaceConfiguration);

		const baseResult: LSP.InitializeResult = {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Full,
			},
		};
		const decorated = this.#serviceRuntime?.runInitializers(params);

		if (decorated) {
			mergeAssign(baseResult, decorated);
		}

		return baseResult;
	}

	async #handleInitialized(_params: LSP.InitializedParams): Promise<void> {
		if (!this.#supportsWorkspaceConfiguration) {
			return;
		}

		await this.#connection.client.register(DidChangeConfigurationNotification.type, {
			section: 'stylelint',
		});
	}

	#handleDidChangeConfiguration(params: LSP.DidChangeConfigurationParams): void {
		if (!this.#optionsService) {
			return;
		}

		this.#optionsService.clearCache();
		this.#optionsService.updateGlobalOptions(params.settings);
	}
}

/**
 * Creates a runtime feature that wires the language server to the shared runtime.
 */
export function createLanguageServerFeature(options: LanguageServerFeatureOptions): RuntimeFeature {
	return new LanguageServerFeature(
		options.connection,
		options.runtimeFactory ?? defaultRuntimeFactory,
	);
}
