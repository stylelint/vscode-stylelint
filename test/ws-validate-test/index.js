'use strict';

const path = require('path');
const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, window, Uri, commands, languages } = require('vscode');
const { normalizeDiagnostic } = require('../utils');

const run = () =>
	test('vscode-stylelint with "stylelint.validate"', async (t) => {
		await commands.executeCommand('vscode.openFolder', Uri.file(__dirname));

		const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

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
		// Wait for diagnostics result.
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Check the result.
		t.deepEqual(languages.getDiagnostics(cssDocument.uri), [], 'should be ignored lint on css.');

		// Execute the Autofix command.
		await commands.executeCommand('stylelint.executeAutofix');

		// Check the result.
		t.equal(
			cssDocument.getText(),
			'/* prettier-ignore */\na {\n  color: red;\n}\n',
			'should be ignored autofix command on css.',
		);

		// Open the './test.scss' file.
		const scssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.scss'));

		await window.showTextDocument(scssDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => languages.getDiagnostics(scssDocument.uri).length > 0, { timeout: 5000 });

		// Check the result.
		t.deepEqual(
			languages.getDiagnostics(scssDocument.uri).map(normalizeDiagnostic),
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
			'should work lint on scss.',
		);

		// Execute the Autofix command.
		await commands.executeCommand('stylelint.executeAutofix');

		// Check the result.
		t.equal(
			scssDocument.getText(),
			'/* prettier-ignore */\na {\n    color: red;\n}\n',
			'should work autofix command on scss.',
		);

		// Open the './test.md' file.
		const mdDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.md'));

		await window.showTextDocument(mdDocument);

		// Wait for diagnostics result.
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Check the result.
		t.deepEqual(
			languages.getDiagnostics(mdDocument.uri),
			[],
			'should be ignored lint on markdown.',
		);

		// Execute the Autofix command.
		await commands.executeCommand('stylelint.executeAutofix');

		// Check the result.
		t.equal(
			mdDocument.getText(),
			'# title\n\n```css\na {\n  color: red;\n}\n```\n',
			'should be ignored autofix command on markdown.',
		);

		t.end();
	});

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};
