'use strict';

const { LanguageClient, SettingMonitor, ExecuteCommandRequest } = require('vscode-languageclient/node');
const { workspace, commands: Commands, window: Window } = require('vscode');

/**
 * @typedef {import('vscode').ExtensionContext} ExtensionContext
 */
/**
 * @param {ExtensionContext} context
 */
exports.activate = ({ subscriptions }) => {
	const serverPath = require.resolve('./server.js');

	const client = new LanguageClient(
		'stylelint',
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
			diagnosticCollectionName: 'stylelint',
			synchronize: {
				configurationSection: 'stylelint',
				fileEvents: workspace.createFileSystemWatcher(
					'**/{.stylelintrc{,.js,.json,.yaml,.yml},stylelint.config.js,.stylelintignore}',
				),
			},
		},
	);

	subscriptions.push(
		Commands.registerCommand('stylelint.executeAutofix', async () => {
			const textEditor = Window.activeTextEditor;

			if (!textEditor) {
				return;
			}

			const textDocument = {
				uri: textEditor.document.uri.toString(),
				version: textEditor.document.version,
			};
			const params = {
				command: 'stylelint.applyAutoFix',
				// https://github.com/microsoft/TypeScript/issues/43362
				/* prettier-ignore */
				'arguments': [textDocument],
			};

			await client.sendRequest(ExecuteCommandRequest.type, params).then(undefined, () => {
				Window.showErrorMessage(
					'Failed to apply stylelint fixes to the document. Please consider opening an issue with steps to reproduce.',
				);
			});
		}),
	);
	subscriptions.push(new SettingMonitor(client, 'stylelint.enable').start());
};
