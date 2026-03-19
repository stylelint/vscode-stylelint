// @no-unit-test -- Relies on VS Code runtime objects and language client side-effects covered by integration tests.

import type {
	Disposable,
	DocumentFilter,
	ExtensionContext,
	LanguageStatusItem,
	WorkspaceFolder,
} from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';

import { inject } from '@stylelint/language-server/di';
import {
	runtimeService,
	type RuntimeLifecycleParticipant,
} from '@stylelint/language-server/di/runtime';
import { CommandId, Status, StatusNotification } from '@stylelint/language-server';
import { extensionTokens } from './di-tokens.js';
import type {
	LanguageClientModule,
	VSCodeCommands,
	VSCodeLanguages,
	VSCodeLanguageStatusSeverity,
	VSCodeWindow,
	VSCodeWorkspace,
} from './services/environment.js';
import { LanguageClientService } from './services/language-client.service.js';

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
		extensionTokens.languages,
		extensionTokens.languageStatusSeverity,
		extensionTokens.languageClientModule,
	],
})
export class ExtensionRuntimeService implements RuntimeLifecycleParticipant {
	readonly #languageClientService: LanguageClientService;
	readonly #window: VSCodeWindow;
	readonly #commands: VSCodeCommands;
	readonly #workspace: VSCodeWorkspace;
	readonly #context: ExtensionContext;
	readonly #languages: VSCodeLanguages;
	readonly #languageStatusSeverity: VSCodeLanguageStatusSeverity;
	readonly #languageClientModule: LanguageClientModule;
	readonly #commandDisposables: Disposable[] = [];
	readonly #documentStatus = new Map<string, Status>();
	#client: LanguageClient;
	#settingMonitorDisposable?: Disposable;
	#configChangeDisposable?: Disposable;
	#languageStatus?: LanguageStatusItem;
	#activeEditorDisposable?: Disposable;
	#closeDocumentDisposable?: Disposable;
	#validateChangeDisposable?: Disposable;
	#settingSnapshots = new Map<string, string>();
	#serverRunning: boolean | undefined;
	#needsRecreate = false;

	constructor(
		languageClientService: LanguageClientService,
		window: VSCodeWindow,
		commands: VSCodeCommands,
		workspace: VSCodeWorkspace,
		context: ExtensionContext,
		languages: VSCodeLanguages,
		languageStatusSeverity: VSCodeLanguageStatusSeverity,
		languageClientModule: LanguageClientModule,
	) {
		this.#languageClientService = languageClientService;
		this.#window = window;
		this.#commands = commands;
		this.#workspace = workspace;
		this.#context = context;
		this.#languages = languages;
		this.#languageStatusSeverity = languageStatusSeverity;
		this.#languageClientModule = languageClientModule;
		this.#client = this.#languageClientService.createClient();
	}

	async onStart(): Promise<void> {
		this.#registerCommands();
		this.#registerConfigurationChangeHandler();
		this.#createLanguageStatusItem();

		this.#settingMonitorDisposable = this.#createEnableSettingHandler();
		this.#context.subscriptions.push(this.#settingMonitorDisposable);

		try {
			await this.#startClient();
		} catch (error) {
			this.#needsRecreate = true;
			await this.#showError(error);
		}
	}

	async onShutdown(): Promise<void> {
		await this.#disposeClient();
		this.#disposeCommands();

		if (this.#languageStatus) {
			try {
				this.#languageStatus.dispose();
			} catch {
				// Best-effort cleanup.
			}

			this.#languageStatus = undefined;
		}

		if (this.#activeEditorDisposable) {
			try {
				this.#activeEditorDisposable.dispose();
			} catch {
				// Best-effort cleanup.
			}

			this.#activeEditorDisposable = undefined;
		}

		if (this.#closeDocumentDisposable) {
			try {
				this.#closeDocumentDisposable.dispose();
			} catch {
				// Best-effort cleanup.
			}

			this.#closeDocumentDisposable = undefined;
		}

		if (this.#validateChangeDisposable) {
			try {
				this.#validateChangeDisposable.dispose();
			} catch {
				// Best-effort cleanup.
			}

			this.#validateChangeDisposable = undefined;
		}

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
		this.#registerClientHandlers();
		await this.#client.start();
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
				} catch (error) {
					await this.#showError(error);
				}
			}

			this.#settingMonitorDisposable = this.#createEnableSettingHandler();
		});

		const lintAllFilesDisposable = this.#commands.registerCommand(
			'stylelint.lintAllFiles',
			async () => {
				try {
					await this.#client.sendRequest('workspace/executeCommand', {
						command: CommandId.LintFiles,
						arguments: [],
					});
				} catch {
					await this.#window.showErrorMessage(
						'Failed to lint files. Please consider opening an issue with steps to reproduce.',
					);
				}
			},
		);

		const lintWorkspaceFolderDisposable = this.#commands.registerCommand(
			'stylelint.lintWorkspaceFolder',
			async (workspaceFolder?: WorkspaceFolder) => {
				const folder =
					workspaceFolder ??
					(this.#workspace.workspaceFolders?.length === 1
						? this.#workspace.workspaceFolders[0]
						: await this.#window.showWorkspaceFolderPick());

				if (!folder) {
					return;
				}

				try {
					await this.#client.sendRequest('workspace/executeCommand', {
						command: CommandId.LintFiles,
						arguments: [folder.uri.toString()],
					});
				} catch {
					await this.#window.showErrorMessage(
						'Failed to lint workspace folder. Please consider opening an issue with steps to reproduce.',
					);
				}
			},
		);

		const showOutputChannelDisposable = this.#commands.registerCommand(
			'stylelint.showOutputChannel',
			() => {
				this.#client.outputChannel.show();
			},
		);

		this.#registerDisposable(executeAutofixDisposable);
		this.#registerDisposable(restartDisposable);
		this.#registerDisposable(lintAllFilesDisposable);
		this.#registerDisposable(lintWorkspaceFolderDisposable);
		this.#registerDisposable(showOutputChannelDisposable);
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

	#registerDisposable(disposable: Disposable): void {
		this.#commandDisposables.push(disposable);
		this.#context.subscriptions.push(disposable);
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

	#createLanguageStatusItem(): void {
		this.#languageStatus = this.#languages.createLanguageStatusItem(
			'stylelint.languageStatus',
			this.#buildLanguageSelector(),
		);
		this.#languageStatus.name = 'Stylelint';
		this.#languageStatus.text = 'Stylelint';
		this.#languageStatus.command = {
			title: 'Open Stylelint Output',
			command: 'stylelint.showOutputChannel',
		};
		this.#context.subscriptions.push(this.#languageStatus);

		this.#activeEditorDisposable = this.#window.onDidChangeActiveTextEditor(() => {
			this.#updateStatusBar();
		});
		this.#context.subscriptions.push(this.#activeEditorDisposable);

		this.#closeDocumentDisposable = this.#workspace.onDidCloseTextDocument((document) => {
			this.#documentStatus.delete(document.uri.toString());
			this.#updateStatusBar();
		});
		this.#context.subscriptions.push(this.#closeDocumentDisposable);

		this.#validateChangeDisposable = this.#workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('stylelint.validate') && this.#languageStatus) {
				this.#languageStatus.selector = this.#buildLanguageSelector();
			}
		});
		this.#context.subscriptions.push(this.#validateChangeDisposable);
	}

	#registerClientHandlers(): void {
		const { State } = this.#languageClientModule;

		this.#client.onDidChangeState((event) => {
			if (event.newState === State.Running) {
				this.#serverRunning = true;
			} else if (event.newState === State.Stopped) {
				this.#serverRunning = false;
			} else {
				this.#serverRunning = undefined;
			}

			this.#updateStatusBar();
		});

		this.#client.onNotification(StatusNotification, (params) => {
			this.#documentStatus.set(params.uri, params.state);
			this.#updateStatusBar();
		});
	}

	#buildLanguageSelector(): DocumentFilter[] {
		const languages = this.#workspace
			.getConfiguration('stylelint')
			.get<string[]>('validate', ['css', 'postcss']);

		return languages.map((language) => ({ language }));
	}

	#updateStatusBar(): void {
		if (!this.#languageStatus) {
			return;
		}

		const LanguageStatusSeverity = this.#languageStatusSeverity;

		if (this.#serverRunning === false) {
			this.#languageStatus.severity = LanguageStatusSeverity.Error;
			this.#languageStatus.detail = 'Server stopped';

			return;
		}

		if (this.#serverRunning === undefined) {
			this.#languageStatus.severity = LanguageStatusSeverity.Information;
			this.#languageStatus.detail = 'Server starting…';

			return;
		}

		const activeUri = this.#window.activeTextEditor?.document.uri.toString();

		if (!activeUri) {
			this.#languageStatus.severity = LanguageStatusSeverity.Information;
			this.#languageStatus.detail = undefined;

			return;
		}

		const status = this.#documentStatus.get(activeUri);

		switch (status) {
			case Status.warn:
				this.#languageStatus.severity = LanguageStatusSeverity.Warning;
				break;
			case Status.error:
				this.#languageStatus.severity = LanguageStatusSeverity.Error;
				break;
			case Status.ok:
			case undefined:
				this.#languageStatus.severity = LanguageStatusSeverity.Information;
				break;
		}

		this.#languageStatus.detail = undefined;
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
