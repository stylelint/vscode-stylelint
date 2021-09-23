'use strict';

const path = require('path');

const { workspace, commands, window } = require('vscode');

describe('vscode-stylelint', () => {
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
