'use strict';

const { join } = require('path');

const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, window, Uri, commands } = require('vscode');

const run = () =>
	test('vscode-stylelint', async (t) => {
		await commands.executeCommand('vscode.openFolder', Uri.file(__dirname));

		const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

		const plaintextDocument = await workspace.openTextDocument({
			content: 'Hello',
			language: 'plaintext',
		});

		await window.showTextDocument(plaintextDocument);

		t.equal(
			vscodeStylelint.isActive,
			false,
			'should not be activated when the open file is not CSS.',
		);

		const cssDocument = await workspace.openTextDocument({
			content: '}',
			language: 'css',
		});

		await window.showTextDocument(cssDocument);
		await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });

		t.pass('should be activated when the open file is CSS.');

		t.equal(
			(await workspace.openTextDocument(join(__dirname, '.stylelintignore'))).languageId,
			'ignore',
			'should add syntax highlighting to .stylelintignore.',
		);

		t.end();
	});

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};
