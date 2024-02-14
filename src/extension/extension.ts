import { EventEmitter } from 'events';
import { LanguageClient, SettingMonitor, ExecuteCommandRequest } from 'vscode-languageclient/node';
import { workspace, commands, window } from 'vscode';
import { ApiEvent, PublicApi } from './types';
import {
	CommandId,
	DidRegisterDocumentFormattingEditProviderNotificationParams,
	Notification,
} from '../server';
import type vscode from 'vscode';

/**
 * Activates the extension.
 */
export function activate({ subscriptions }: vscode.ExtensionContext): PublicApi {
	const serverPath = require.resolve('./start-server');

	const api = Object.assign(new EventEmitter(), { codeActionReady: false }) as PublicApi;

	const client = new LanguageClient(
		'Stylelint',
		{
			run: {
				module: serverPath,
			},
			debug: {
				module: serverPath,
				options: {
					execArgv: ['--nolazy', '--inspect=6004'],
				},
			},
		},
		{
			documentSelector: [{ scheme: 'file' }, { scheme: 'untitled' }],
			diagnosticCollectionName: 'Stylelint',
			synchronize: {
				fileEvents: [
					workspace.createFileSystemWatcher('**/.stylelintrc{,.js,.json,.yaml,.yml}'),
					workspace.createFileSystemWatcher('**/{stylelint.config.js,.stylelintignore}'),
				],
			},
		},
	);

	const readyHandler = (): void => {
		client.onNotification(Notification.DidRegisterCodeActionRequestHandler, () => {
			api.codeActionReady = true;
		});
		client.onNotification(
			Notification.DidRegisterDocumentFormattingEditProvider,
			(params: DidRegisterDocumentFormattingEditProviderNotificationParams) => {
				api.emit(ApiEvent.DidRegisterDocumentFormattingEditProvider, params);
			},
		);
		client.onNotification(Notification.DidResetConfiguration, () => {
			api.emit(ApiEvent.DidResetConfiguration);
		});
	};

	const errorHandler = async (error: unknown): Promise<void> => {
		await window.showErrorMessage(
			`Stylelint: ${error instanceof Error ? error.message : String(error)}`,
		);
	};

	client.onReady().then(readyHandler).catch(errorHandler);

	subscriptions.push(
		// cspell:disable-next-line
		commands.registerCommand('stylelint.executeAutofix', async () => {
			const textEditor = window.activeTextEditor;

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
				await client.sendRequest(ExecuteCommandRequest.type, params);
			} catch {
				await window.showErrorMessage(
					'Failed to apply Stylelint fixes to the document. Please consider opening an issue with steps to reproduce.',
				);
			}
		}),
	);

	subscriptions.push(
		commands.registerCommand('stylelint.restart', async () => {
			await client.stop();
			client.start();

			try {
				await client.onReady();
				readyHandler();
			} catch (error: unknown) {
				await errorHandler(error);
			}
		}),
	);

	subscriptions.push(new SettingMonitor(client, 'stylelint.enable').start());

	return api;
}
