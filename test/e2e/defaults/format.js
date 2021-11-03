'use strict';

const path = require('path');

const pWaitFor = require('p-wait-for');
const { workspace, commands, window, extensions } = require('vscode');

const workspaceDir = path.join(__dirname, 'workspace');

describe('Document formatting', () => {
	beforeAll(async () => {
		const extension = extensions.getExtension('stylelint.vscode-stylelint');

		if (!extension) {
			throw new Error('Unable to find Stylelint extension');
		}

		const api = /** @type {ExtensionPublicApi} */ (extension.exports);

		await pWaitFor(() => api.formattingReady);
	});

	it('should format document using formatting options', async () => {
		const cssDocument = await workspace.openTextDocument(path.resolve(workspaceDir, 'format.css'));

		const editor = await window.showTextDocument(cssDocument);

		editor.options.tabSize = 4;
		editor.options.insertSpaces = false;

		await commands.executeCommand('editor.action.formatDocument');

		expect(cssDocument.getText()).toMatchSnapshot();
	}, 30000);
});
