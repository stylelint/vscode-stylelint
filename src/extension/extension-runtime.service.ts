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
import { LanguageClientService } from './services/language-client.service.js';
import { ApiEvent, type PublicApi } from './types.js';

const workspaceNotificationError =
	'Failed to apply Stylelint fixes to the document. Please consider opening an issue with steps to reproduce.';

@runtimeService()
@inject({
	inject: [
		LanguageClientService,
		extensionTokens.window,
		extensionTokens.commands,
		extensionTokens.workspace,
		extensionTokens.context,
		extensionTokens.publicApi,
	],
})
export class ExtensionRuntimeService implements RuntimeLifecycleParticipant {
	readonly #languageClientService: LanguageClientService;
	readonly #window: VSCodeWindow;
	readonly #commands: VSCodeCommands;
	readonly #workspace: VSCodeWorkspace;
	readonly #context: ExtensionContext;
	readonly #api: PublicApi;
	readonly #notificationDisposables: Disposable[] = [];
	readonly #commandDisposables: Disposable[] = [];
	#client: LanguageClient;
	#settingMonitorDisposable?: Disposable;
	#configChangeDisposable?: Disposable;
	#settingSnapshots = new Map<string, string>();
	#needsRecreate = false;

	constructor(
		languageClientService: LanguageClientService,
		window: VSCodeWindow,
		commands: VSCodeCommands,
		workspace: VSCodeWorkspace,
		context: ExtensionContext,
		api: PublicApi,
	) {
		this.#languageClientService = languageClientService;
		this.#window = window;
		this.#commands = commands;
		this.#workspace = workspace;
		this.#context = context;
		this.#api = api;
		this.#client = this.#languageClientService.createClient();
	}

	async onStart(): Promise<void> {
		this.#registerCommands();
		this.#registerConfigurationChangeHandler();

		this.#settingMonitorDisposable = this.#createEnableSettingHandler();
		this.#context.subscriptions.push(this.#settingMonitorDisposable);

		try {
			await this.#startClient();
		} catch (error) {
			this.#needsRecreate = true;
			await this.#showError(error);

			return;
		}

		await this.#resetWorkspaceState();
	}

	async onShutdown(): Promise<void> {
		await this.#disposeClient();
		this.#disposeNotifications();
		this.#disposeCommands();

		if (this.#configChangeDisposable) {
			try {
				this.#configChangeDisposable.dispose();
			} catch {
				// Best-effort cleanup.
			}

			this.#configChangeDisposable = undefined;
		}

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

	/**
	 * Watches stylelint.enable and starts/stops the current client accordingly.
	 * Returns a disposable that removes the listener.
	 */
	#createEnableSettingHandler(): Disposable {
		return this.#workspace.onDidChangeConfiguration(async (event) => {
			if (!event.affectsConfiguration('stylelint.enable')) {
				return;
			}

			const enabled = this.#workspace.getConfiguration('stylelint').get<boolean>('enable', true);

			if (enabled && (this.#needsRecreate || this.#client.needsStart())) {
				try {
					if (this.#needsRecreate) {
						this.#needsRecreate = false;
						await this.#disposeClient();
						this.#client = this.#languageClientService.createClient();
					}

					await this.#startClient();
				} catch (error) {
					this.#needsRecreate = true;
					await this.#showError(error);
				}
			} else if (!enabled && this.#client.needsStop()) {
				try {
					await this.#client.stop();
				} catch (error) {
					if (!this.#isClientInactiveError(error)) {
						await this.#showError(error);
					}
				}
			}
		});
	}

	async #disposeClient(): Promise<void> {
		try {
			await this.#client.dispose();
		} catch (error) {
			if (this.#isClientInactiveError(error)) {
				return;
			}

			throw error instanceof Error ? error : new Error('unknown');
		}
	}

	#registerNotificationHandlers(): void {
		this.#disposeNotifications();

		const client = this.#client;

		this.#notificationDisposables.push(
			client.onNotification(Notification.DidRegisterCodeActionRequestHandler, () => {
				this.#api.codeActionReady = true;
			}),
			client.onNotification(
				Notification.DidRegisterDocumentFormattingEditProvider,
				(params: DidRegisterDocumentFormattingEditProviderNotificationParams) => {
					this.#api.emit(ApiEvent.DidRegisterDocumentFormattingEditProvider, params);
				},
			),
			client.onNotification(Notification.DidResetConfiguration, () => {
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
			this.#settingMonitorDisposable?.dispose();
			this.#settingMonitorDisposable = undefined;
			this.#disposeNotifications();

			try {
				await this.#disposeClient();
			} catch (error) {
				if (!this.#isClientInactiveError(error)) {
					await this.#showError(error);

					return;
				}
			}

			this.#client = this.#languageClientService.createClient();
			this.#needsRecreate = false;

			const enabled = this.#workspace.getConfiguration('stylelint').get<boolean>('enable', true);

			if (enabled) {
				try {
					await this.#startClient();
					await this.#resetWorkspaceState();
				} catch (error) {
					await this.#showError(error);
				}
			}

			this.#settingMonitorDisposable = this.#createEnableSettingHandler();
		});

		this.#registerDisposable(executeAutofixDisposable);
		this.#registerDisposable(restartDisposable);
	}

	#registerConfigurationChangeHandler(): void {
		/**
		 * Settings that require a restart when changed. Each entry maps a
		 * setting key under "stylelint." to the restart strategy. "server"
		 * means just the language server needs a restart, "extension-host"
		 * means the entire extension host needs a restart for the setting to
		 * take effect.
		 */
		const restartSettings: Record<string, 'extension-host' | 'server'> = {
			logLevel: 'extension-host',
			runtime: 'server',
			execArgv: 'server',
		};

		const settingKeys = Object.keys(restartSettings);

		// Snapshot current values.
		const config = this.#workspace.getConfiguration('stylelint');

		for (const key of settingKeys) {
			this.#settingSnapshots.set(key, JSON.stringify(config.get(key)));
		}

		this.#configChangeDisposable = this.#workspace.onDidChangeConfiguration(async (event) => {
			const qualifiedKeys = settingKeys.map((key) => `stylelint.${key}`);

			if (!qualifiedKeys.some((qk) => event.affectsConfiguration(qk))) {
				return;
			}

			const currentConfig = this.#workspace.getConfiguration('stylelint');

			let needsExtensionHostRestart = false;
			const changedSettings = new Set<string>();

			for (const key of settingKeys) {
				const newValue = JSON.stringify(currentConfig.get(key));

				if (newValue !== this.#settingSnapshots.get(key)) {
					this.#settingSnapshots.set(key, newValue);
					changedSettings.add(key);

					if (restartSettings[key] === 'extension-host') {
						needsExtensionHostRestart = true;
					}
				}
			}

			// When an extension host restart is needed, only mention those
			// settings in the message, since only those settings actually
			// require the full restart.
			const relevantKeys = needsExtensionHostRestart
				? [...changedSettings].filter((k) => restartSettings[k] === 'extension-host')
				: [...changedSettings];

			if (relevantKeys.length === 0) {
				return;
			}

			this.#needsRecreate = true;

			const enabled = currentConfig.get<boolean>('enable', true);

			// When the extension is disabled, only extension host changes still
			// need a prompt. The enable handler will recreate the client when
			// the user re-enables.
			//
			// Likewise, if enable just flipped to true in the same edit, the
			// the enable handler will pick up #needsRecreate and handle the
			// server restart, so skip the redundant prompt.
			if (
				!needsExtensionHostRestart &&
				(!enabled || event.affectsConfiguration('stylelint.enable'))
			) {
				return;
			}

			const subject =
				relevantKeys.length === 1
					? `The stylelint.${relevantKeys[0]} setting has`
					: 'Stylelint server settings have';

			const { label, command } = needsExtensionHostRestart
				? { label: 'Restart Extension Host', command: 'workbench.action.restartExtensionHost' }
				: { label: 'Restart Stylelint Server', command: 'stylelint.restart' };

			const target = needsExtensionHostRestart ? 'extension host' : 'Stylelint server';

			const result = await this.#window.showInformationMessage(
				`${subject} changed. Restart the ${target} for the change to take effect.`,
				label,
			);

			if (result === label) {
				await this.#commands.executeCommand(command);
			}
		});

		this.#context.subscriptions.push(this.#configChangeDisposable);
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

	#isClientInactiveError(error: unknown): boolean {
		if (!(error instanceof Error)) {
			return false;
		}

		return (
			error.message.includes('connection got disposed') ||
			error.message.includes("can't be stopped")
		);
	}
}
