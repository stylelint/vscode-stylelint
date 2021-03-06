'use strict';

const path = require('path');
const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, window, Uri, commands } = require('vscode');
const { normalizeDiagnostic, getStylelintDiagnostics } = require('../utils');

const run = () =>
	test('vscode-stylelint with "stylelint.stylelintPath"', async (t) => {
		await commands.executeCommand('vscode.openFolder', Uri.file(__dirname));

		const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });
		await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		// Check the result.
		const diagnostics = getStylelintDiagnostics(cssDocument.uri);

		t.deepEqual(
			diagnostics.map(normalizeDiagnostic),
			[
				{
					range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
					code: 'fake',
					message: 'Fake result',
					severity: 0,
					source: 'stylelint',
				},
			],
			'should work even if "stylelint.stylelintPath" is defined.',
		);

		t.end();
	});

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};
