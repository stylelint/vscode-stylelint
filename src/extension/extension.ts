import { EventEmitter } from 'node:events';
import path from 'node:path';

import { LanguageClient, SettingMonitor, ExecuteCommandRequest } from 'vscode-languageclient/node';
import { workspace, commands, window, type ExtensionContext } from 'vscode';
import { ApiEvent, PublicApi } from './types';
import {
	CommandId,
	DidRegisterDocumentFormattingEditProviderNotificationParams,
	Notification,
} from '../server/index';

let client: LanguageClient;

/**
 * Activates the extension.
 */
export async function activate({ subscriptions }: ExtensionContext): Promise<PublicApi> {
	const serverPath = path.join(__dirname, 'start-server.js');

	const api = Object.assign(new EventEmitter(), { codeActionReady: false }) as PublicApi;

	client = new LanguageClient(
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

	const errorHandler = async (error: unknown): Promise<void> => {
		await window.showErrorMessage(
			`Stylelint: ${error instanceof Error ? error.message : String(error)}`,
		);
	};

	const notificationHandlers = (): void => {
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

	try {
		await client.start();
		notificationHandlers();
	} catch (err) {
		await errorHandler(err);
	}

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

			try {
				await client.start();
				notificationHandlers();
			} catch (error: unknown) {
				await errorHandler(error);
			}
		}),
	);

	subscriptions.push(new SettingMonitor(client, 'stylelint.enable').start());

	return Promise.resolve(api);
}

/**
 * @returns A promise that resolves when the client has been deactivated.
 */
export async function deactivate(): Promise<void> {
	if (client) {
		try {
			return client.stop();
		} catch (err) {
			const msg = err && (err as Error) ? (err as Error).message : 'unknown';

			await window.showErrorMessage(`error stopping stylelint language server: ${msg}`);
			throw err;
		}
	}
}
