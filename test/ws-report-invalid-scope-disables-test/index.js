'use strict';

const path = require('path');
const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, window, Uri, commands, languages } = require('vscode');
const { normalizeDiagnostic } = require('../utils');

const run = () =>
	test('vscode-stylelint with "stylelint.reportInvalidScopeDisables"', async (t) => {
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
					range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } },
					message: 'unused rule: foo, start line: 2, end line: 2',
					severity: 1,
					code: 'foo',
					source: 'stylelint',
				},
				{
					range: { start: { line: 2, character: 0 }, end: { line: 2, character: 32 } },
					message: 'unused rule: foo, start line: 3, end line: 3',
					severity: 1,
					code: 'foo',
					source: 'stylelint',
				},
				{
					range: { start: { line: 4, character: 0 }, end: { line: 5, character: 26 } },
					message: 'unused rule: foo, start line: 5, end line: 6',
					severity: 1,
					code: 'foo',
					source: 'stylelint',
				},
			],
			'should work if "stylelint.reportInvalidScopeDisables" is enabled.',
		);

		t.end();
	});

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};
