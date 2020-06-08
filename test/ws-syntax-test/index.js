'use strict';

const path = require('path');
const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, window, Uri, commands, languages } = require('vscode');
const { normalizeDiagnostic } = require('../utils');

const run = () =>
	test('vscode-stylelint with "stylelint.syntax"', async (t) => {
		await commands.executeCommand('vscode.openFolder', Uri.file(__dirname));

		const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });
		await pWaitFor(() => languages.getDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		// Check the result.
		const diagnostics = languages.getDiagnostics(cssDocument.uri);

		t.deepEqual(
			diagnostics.map(normalizeDiagnostic),
			[
				{
					range: { start: { line: 2, character: 2 }, end: { line: 2, character: 2 } },
					message: 'Expected indentation of 4 spaces (indentation)',
					severity: 0,
					code: {
						value: 'indentation',
						target: {
							scheme: 'https',
							authority: 'stylelint.io',
							path: '/user-guide/rules/indentation',
						},
					},
					source: 'stylelint',
				},
			],
			'should work even if "stylelint.syntax" is defined.',
		);

		t.end();
	});

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};
