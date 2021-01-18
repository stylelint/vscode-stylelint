'use strict';

const path = require('path');
const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, window, Uri, commands } = require('vscode');
const { normalizeDiagnostic, getStylelintDiagnostics } = require('../utils');

const run = () =>
	test('vscode-stylelint with "stylelint.configFile"', async (t) => {
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
					range: { start: { line: 2, character: 9 }, end: { line: 2, character: 9 } },
					message: 'Expected "#fff" to be "#FFF" (color-hex-case)',
					severity: 0,
					code: {
						value: 'color-hex-case',
						target: {
							scheme: 'https',
							authority: 'stylelint.io',
							path: '/user-guide/rules/color-hex-case',
						},
					},
					source: 'stylelint',
				},
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
			'should work even if "stylelint.configFile" is defined.',
		);

		t.end();
	});

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};
