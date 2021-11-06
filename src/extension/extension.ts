import { EventEmitter } from 'events';
import { LanguageClient, SettingMonitor, ExecuteCommandRequest } from 'vscode-languageclient/node';
import { workspace, commands, window } from 'vscode';
import { ApiEvent, PublicApi } from './types';
import { CommandId, Notification } from '../server';
import type vscode from 'vscode';

/**
 * Activates the extension.
 */
export function activate({ subscriptions }: vscode.ExtensionContext): PublicApi {
	const serverPath = require.resolve('./start-server');

	const api: PublicApi = Object.assign(new EventEmitter(), {
		formattingReady: false,
	});

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
				configurationSection: 'stylelint',
				fileEvents: workspace.createFileSystemWatcher(
					'**/{.stylelintrc{,.js,.json,.yaml,.yml},stylelint.config.js,.stylelintignore}',
				),
			},
		},
	);

	client.onReady().then(() => {
		client.onNotification(Notification.DidRegisterDocumentFormattingEditProvider, () => {
			api.formattingReady = true;
			api.emit(ApiEvent.DidRegisterDocumentFormattingEditProvider);
		});
	});

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

			await client.sendRequest(ExecuteCommandRequest.type, params).then(undefined, () => {
				window.showErrorMessage(
					'Failed to apply Stylelint fixes to the document. Please consider opening an issue with steps to reproduce.',
				);
			});
		}),
	);

	subscriptions.push(new SettingMonitor(client, 'stylelint.enable').start());

	return api;
}
