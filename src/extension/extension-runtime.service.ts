// @no-unit-test -- Relies on VS Code runtime objects and language client side-effects covered by integration tests.

import type { Disposable, ExtensionContext } from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';

import { inject } from '../di/index.js';
import { runtimeService, type RuntimeLifecycleParticipant } from '../di/runtime/index.js';
import {
	CommandId,
	Notification,
	type DidRegisterDocumentFormattingEditProviderNotificationParams,
} from '../server/index.js';
import { extensionTokens } from './di-tokens.js';
import type { VSCodeCommands, VSCodeWindow, VSCodeWorkspace } from './services/environment.js';
import type { SettingMonitorFactory } from './services/language-client.js';
import { ApiEvent, type PublicApi } from './types.js';

const workspaceNotificationError =
	'Failed to apply Stylelint fixes to the document. Please consider opening an issue with steps to reproduce.';

@runtimeService()
@inject({
	inject: [
		extensionTokens.languageClient,
		extensionTokens.window,
		extensionTokens.commands,
		extensionTokens.workspace,
		extensionTokens.context,
		extensionTokens.settingMonitorFactory,
		extensionTokens.publicApi,
	],
})
export class ExtensionRuntimeService implements RuntimeLifecycleParticipant {
	readonly #client: LanguageClient;
	readonly #window: VSCodeWindow;
	readonly #commands: VSCodeCommands;
	readonly #workspace: VSCodeWorkspace;
	readonly #context: ExtensionContext;
	readonly #createSettingMonitor: SettingMonitorFactory;
	readonly #api: PublicApi;
	readonly #notificationDisposables: Disposable[] = [];
	readonly #commandDisposables: Disposable[] = [];
	#settingMonitorDisposable?: Disposable;

	constructor(
		languageClient: LanguageClient,
		window: VSCodeWindow,
		commands: VSCodeCommands,
		workspace: VSCodeWorkspace,
		context: ExtensionContext,
		settingMonitorFactory: SettingMonitorFactory,
		api: PublicApi,
	) {
		this.#client = languageClient;
		this.#window = window;
		this.#commands = commands;
		this.#workspace = workspace;
		this.#context = context;
		this.#createSettingMonitor = settingMonitorFactory;
		this.#api = api;
	}

	async onStart(): Promise<void> {
		try {
			await this.#startClient();
		} catch (error) {
			await this.#showError(error);
		}

		await this.#resetWorkspaceState();
		this.#registerCommands();

		this.#settingMonitorDisposable = this.#createSettingMonitor(this.#client).start();
		this.#context.subscriptions.push(this.#settingMonitorDisposable);
	}

	async onShutdown(): Promise<void> {
		await this.#stopClient();
		this.#disposeNotifications();
		this.#disposeCommands();

		if (this.#settingMonitorDisposable) {
			try {
				this.#settingMonitorDisposable.dispose();
			} catch {
				// Best-effort cleanup.
			}

			this.#settingMonitorDisposable = undefined;
		}
	}

	async #startClient(): Promise<void> {
		await this.#client.start();
		this.#registerNotificationHandlers();
	}

	async #stopClient(): Promise<void> {
		try {
			await this.#client.stop();
		} catch (error) {
			if (this.#isConnectionDisposedError(error)) {
				return;
			}

			throw error instanceof Error ? error : new Error('unknown');
		}
	}

	#registerNotificationHandlers(): void {
		this.#disposeNotifications();

		this.#notificationDisposables.push(
			this.#client.onNotification(Notification.DidRegisterCodeActionRequestHandler, () => {
				this.#api.codeActionReady = true;
			}),
			this.#client.onNotification(
				Notification.DidRegisterDocumentFormattingEditProvider,
				(params: DidRegisterDocumentFormattingEditProviderNotificationParams) => {
					this.#api.emit(ApiEvent.DidRegisterDocumentFormattingEditProvider, params);
				},
			),
			this.#client.onNotification(Notification.DidResetConfiguration, () => {
				this.#api.emit(ApiEvent.DidResetConfiguration);
			}),
		);
	}

	#registerCommands(): void {
		const executeAutofixDisposable = this.#commands.registerCommand(
			'stylelint.executeAutofix',
			async () => {
				const textEditor = this.#window.activeTextEditor;

				if (!textEditor) {
					return;
				}

				const textDocument = {
					uri: textEditor.document.uri.toString(),
					version: textEditor.document.version,
				};
				const params = {
					command: CommandId.ApplyAutoFix,
					arguments: [textDocument],
				};

				try {
					await this.#client.sendRequest('workspace/executeCommand', params);
				} catch {
					await this.#window.showErrorMessage(workspaceNotificationError);
				}
			},
		);

		const restartDisposable = this.#commands.registerCommand('stylelint.restart', async () => {
			await this.#resetWorkspaceState();

			try {
				await this.#client.stop();
			} catch (error) {
				if (!this.#isConnectionDisposedError(error)) {
					await this.#showError(error);

					return;
				}
			}

			try {
				await this.#startClient();
				await this.#resetWorkspaceState();
			} catch (error) {
				await this.#showError(error);
			}
		});

		this.#registerDisposable(executeAutofixDisposable);
		this.#registerDisposable(restartDisposable);
	}

	async #resetWorkspaceState(): Promise<void> {
		const folders = this.#workspace.workspaceFolders ?? [];

		await Promise.all(
			folders.map(async (folder) =>
				this.#client.sendNotification(Notification.ResetWorkspaceState, {
					workspaceFolder: folder.uri.fsPath,
				}),
			),
		);
	}

	#registerDisposable(disposable: Disposable): void {
		this.#commandDisposables.push(disposable);
		this.#context.subscriptions.push(disposable);
	}

	#disposeNotifications(): void {
		for (const disposable of this.#notificationDisposables) {
			try {
				disposable.dispose();
			} catch {
				// Ignore clean-up failures.
			}
		}

		this.#notificationDisposables.length = 0;
	}

	#disposeCommands(): void {
		for (const disposable of this.#commandDisposables) {
			try {
				disposable.dispose();
			} catch {
				// Ignore clean-up failures.
			}
		}

		this.#commandDisposables.length = 0;
	}

	async #showError(error: unknown): Promise<void> {
		await this.#window.showErrorMessage(
			`Stylelint: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	#isConnectionDisposedError(error: unknown): boolean {
		return error instanceof Error && error.message.includes('connection got disposed');
	}
}
