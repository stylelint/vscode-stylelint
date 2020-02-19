'use strict';

const { join } = require('path');

const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, Uri, commands } = require('vscode');

const run = () =>
	test('vscode-stylelint', async (t) => {
		await commands.executeCommand('vscode.openFolder', Uri.file(__dirname));

		const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

		await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });

		t.pass('should be activated when the VS Code starts up.');

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
