'use strict';

const path = require('path');
const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, window, Uri, commands } = require('vscode');
const { normalizeDiagnostic, getStylelintDiagnostics } = require('../utils');

const run = () => {
	test('vscode-stylelint with "stylelint.ignorePath"', async (t) => {
		await commands.executeCommand('vscode.openFolder', Uri.file(__dirname));

		const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });
		await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		// Check the result.
		const diagnostics1 = getStylelintDiagnostics(cssDocument.uri);

		t.deepEqual(
			diagnostics1.map(normalizeDiagnostic),
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
			'should work even if stylelint.',
		);

		// Open the './test-ignore.css' file.
		const ignoredCssDocument = await workspace.openTextDocument(
			path.resolve(__dirname, 'test-ignore.css'),
		);

		await window.showTextDocument(ignoredCssDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Check the result.
		t.deepEqual(
			getStylelintDiagnostics(ignoredCssDocument.uri),
			[],
			'should work even if "stylelint.ignorePath" is defined.',
		);

		t.end();
	});
};

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};
