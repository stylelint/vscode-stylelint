'use strict';

const path = require('path');
const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, window, Uri, commands, languages } = require('vscode');
const { normalizeDiagnostic } = require('../utils');

const run = () =>
	test('vscode-stylelint lint test', async (t) => {
		await commands.executeCommand('vscode.openFolder', Uri.file(__dirname));

		const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });
		await pWaitFor(() => languages.getDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		// Check the result.
		t.deepEqual(
			languages.getDiagnostics(cssDocument.uri).map(normalizeDiagnostic),
			[
				{
					range: { start: { line: 0, character: 5 }, end: { line: 0, character: 5 } },
					message: 'Bar (plugin/foo-bar)',
					severity: 0,
					code: 'plugin/foo-bar',
					source: 'stylelint',
				},
				{
					range: { start: { line: 6, character: 11 }, end: { line: 6, character: 11 } },
					message: 'Unexpected invalid hex color "#y3" (color-no-invalid-hex)',
					severity: 0,
					code: {
						value: 'color-no-invalid-hex',
						target: {
							scheme: 'https',
							authority: 'stylelint.io',
							path: '/user-guide/rules/color-no-invalid-hex',
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
			'should display correctly that rule documentation links.',
		);

		t.end();
	});

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};
