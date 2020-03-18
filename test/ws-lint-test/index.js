'use strict';

const path = require('path');
const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, window, Uri, commands, languages } = require('vscode');

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
			languages
				.getDiagnostics(cssDocument.uri)
				.map((o) => ({ ...o, range: normalizeRange(o.range) })),
			[
				{
					range: { start: { line: 2, character: 2 }, end: { line: 2, character: 2 } },
					message: 'Expected indentation of 4 spaces (indentation)',
					severity: 0,
					code: 'indentation',
					source: 'stylelint',
				},
			],
			'should work on css.',
		);

		// Open the './test.scss' file.
		const scssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.scss'));

		await window.showTextDocument(scssDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => languages.getDiagnostics(scssDocument.uri).length > 0, { timeout: 5000 });

		// Check the result.
		t.deepEqual(
			languages
				.getDiagnostics(scssDocument.uri)
				.map((o) => ({ ...o, range: normalizeRange(o.range) })),
			[
				{
					range: { start: { line: 2, character: 2 }, end: { line: 2, character: 2 } },
					message: 'Expected indentation of 4 spaces (indentation)',
					severity: 0,
					code: 'indentation',
					source: 'stylelint',
				},
			],
			'should work on scss.',
		);

		// Open the './test.md' file.
		const mdDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.md'));

		await window.showTextDocument(mdDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => languages.getDiagnostics(mdDocument.uri).length > 0, { timeout: 5000 });

		// Check the result.
		t.deepEqual(
			languages
				.getDiagnostics(mdDocument.uri)
				.map((o) => ({ ...o, range: normalizeRange(o.range) })),
			[
				{
					range: { start: { line: 4, character: 2 }, end: { line: 4, character: 2 } },
					message: 'Expected indentation of 4 spaces (indentation)',
					severity: 0,
					code: 'indentation',
					source: 'stylelint',
				},
			],
			'should work on markdown.',
		);

		t.end();
	});

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};

function normalizeRange(range) {
	const obj = {
		start: {
			line: range.start.line,
			character: range.start.character,
		},
	};

	if (range.end !== undefined) {
		obj.end = {
			line: range.end.line,
			character: range.end.character,
		};
	}

	return obj;
}
