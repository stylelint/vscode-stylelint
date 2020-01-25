'use strict';

const path = require('path');
const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, window, Uri, commands } = require('vscode');

const run = () =>
	test('vscode-stylelint with "stylelint.customSyntax"', async (t) => {
		await commands.executeCommand('vscode.openFolder', Uri.file(__dirname));

		const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

		// Wait until the Autofix command is available.
		await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });
		await pWaitFor(
			async () => {
				const names = await commands.getCommands();

				return (
					names.includes('stylelint.executeAutofix') && names.includes('stylelint.applyAutoFix')
				);
			},
			{ timeout: 2000 },
		);

		// Execute the Autofix command.
		await commands.executeCommand('stylelint.executeAutofix');

		// Check the result.
		t.equal(
			cssDocument.getText(),
			'/* prettier-ignore */\n.foo .bar\n    color: red',
			'The autofix should work if "stylelint.customSyntax" is enabled.',
		);

		t.end();
	});

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};
