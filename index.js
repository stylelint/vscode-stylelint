'use strict';

const {
	LanguageClient,
	SettingMonitor,
	ExecuteCommandRequest,
	DocumentFormattingRequest,
	TextDocumentIdentifier,
} = require('vscode-languageclient');
const { workspace, commands: Commands, window: Window, languages: Languages } = require('vscode');

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

	client.onReady().then(() => {
		/**
		 * Map of registered formatters by language ID.
		 * @type {Map<string, { dispose(): any }>}
		 */
		const registeredFormatters = new Map();

		client.onNotification(
			'stylelint/languageIdsAdded',
			(/** @type {{langIds: string[]}} */ { langIds }) => {
				for (const langId of langIds) {
					// Avoid registering another formatter if we already registered one for the same language ID.
					if (registeredFormatters.has(langId)) {
						return;
					}

					const formatter = Languages.registerDocumentFormattingEditProvider(langId, {
						provideDocumentFormattingEdits(textDocument, options) {
							const params = {
								textDocument: TextDocumentIdentifier.create(textDocument.uri.toString()),
								options, // Editor formatting options, overriden by stylelint config.
							};

							// Request that the language server formats the document.
							return client
								.sendRequest(DocumentFormattingRequest.type, params)
								.then(undefined, () => {
									Window.showErrorMessage(
										'Failed to format the document using stylelint. Please consider opening an issue with steps to reproduce.',
									);

									return null;
								});
						},
					});

					// Keep track of the new formatter.
					registeredFormatters.set(langId, formatter);
				}
			},
		);

		client.onNotification(
			'stylelint/languageIdsRemoved',
			(/** @type {{langIds: string[]}} */ { langIds }) => {
				for (const langId of langIds) {
					const formatter = registeredFormatters.get(langId);

					if (!formatter) {
						return;
					}

					// Unregisters formatter.
					formatter.dispose();
					registeredFormatters.delete(langId);
				}
			},
		);

		// Make sure that formatters are disposed when extension is unloaded.
		subscriptions.push({
			dispose() {
				for (const formatter of registeredFormatters.values()) {
					formatter.dispose();
				}
			},
		});
	});

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
				arguments: [textDocument],
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
