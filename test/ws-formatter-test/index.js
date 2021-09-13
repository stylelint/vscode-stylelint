'use strict';

const fs = require('fs/promises');
const path = require('path');

const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, Uri, commands, window } = require('vscode');

const run = () =>
	test('vscode-stylelint', async (t) => {
		const expectedCss = await fs.readFile(path.resolve(__dirname, 'test.expected.css'), 'utf8');

		await commands.executeCommand('vscode.openFolder', Uri.file(__dirname));

		const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

		// Open the './test.input.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.input.css'));

		await window.showTextDocument(cssDocument);

		await commands.executeCommand('editor.action.indentUsingTabs', {
			tabSize: 4,
			indentSize: 4,
			insertSpaces: false,
		});

		await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });

		await commands.executeCommand('editor.action.formatDocument');

		t.equal(cssDocument.getText(), expectedCss, 'should format document using formatting options.');

		t.end();
	});

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};
