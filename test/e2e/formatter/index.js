'use strict';

const path = require('path');

const { workspace, commands, window, extensions } = require('vscode');
const { ApiEvent } = require('../../../src/utils/types');

describe('vscode-stylelint', () => {
	beforeAll(async () => {
		const extension = extensions.getExtension('stylelint.vscode-stylelint');

		if (!extension) {
			throw new Error('Unable to find Stylelint extension');
		}

		const api = /** @type {ExtensionPublicApi} */ (extension.exports);

		await /** @type {Promise<void>} */ (
			new Promise((resolve, reject) => {
				const timeout = setTimeout(
					() =>
						reject(new Error('Did not receive DidRegisterDocumentFormattingEditProvider event')),
					2000,
				);

				api.on(ApiEvent.DidRegisterDocumentFormattingEditProvider, () => {
					clearTimeout(timeout);
					resolve();
				});
			})
		);
	});

	it('should format document using formatting options', async () => {
		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		const editor = await window.showTextDocument(cssDocument);

		editor.options.tabSize = 4;
		editor.options.insertSpaces = false;

		await commands.executeCommand('editor.action.formatDocument');

		expect(cssDocument.getText()).toMatchSnapshot();
	}, 30000);
});
