import path from 'path';
import { workspace, commands, window, extensions } from 'vscode';
import { URI } from 'vscode-uri';
import { PublicApi, ApiEvent } from '../../../src/extension';

describe('Document formatting', () => {
	it('should format document using formatting options', async () => {
		const extension = extensions.getExtension('stylelint.vscode-stylelint');

		if (!extension) {
			throw new Error('Unable to find Stylelint extension');
		}

		const api = extension.exports as PublicApi;

		// api is an event emitter. Wait for the DidRegisterDocumentFormattingEditProvider
		// event to be emitted before continuing.

		const documentPath = path.resolve(workspaceDir, 'defaults/format.css');

		const eventPromise = new Promise<void>((resolve, reject) => {
			api.on(ApiEvent.DidRegisterDocumentFormattingEditProvider, ({ uri }) => {
				const { fsPath } = URI.parse(uri);

				if (path.relative(documentPath, fsPath) === '') {
					resolve();
				}
			});

			setTimeout(() => {
				reject(new Error('Timed out waiting for DidRegisterDocumentFormattingEditProvider event'));
			}, 5000);
		});

		const cssDocument = await workspace.openTextDocument(
			path.resolve(workspaceDir, 'defaults/format.css'),
		);

		const editor = await window.showTextDocument(cssDocument);

		await eventPromise;

		editor.options.tabSize = 4;
		editor.options.insertSpaces = false;

		await commands.executeCommand('editor.action.formatDocument');

		expect(cssDocument.getText()).toMatchSnapshot();
	}, 30000);
});
