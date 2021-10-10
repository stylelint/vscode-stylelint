'use strict';

const path = require('path');

const pWaitFor = require('p-wait-for');
const { workspace, window } = require('vscode');

const { normalizeDiagnostic, getStylelintDiagnostics } = require('../utils');

describe('vscode-stylelint lint test', () => {
	it('should work on css', async () => {
		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

		await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		expect(getStylelintDiagnostics(cssDocument.uri).map(normalizeDiagnostic)).toMatchSnapshot();
	});

	it('should work on scss', async () => {
		// Open the './test.scss' file.
		const scssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.scss'));

		await window.showTextDocument(scssDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => getStylelintDiagnostics(scssDocument.uri).length > 0, { timeout: 5000 });

		expect(getStylelintDiagnostics(scssDocument.uri).map(normalizeDiagnostic)).toMatchSnapshot();
	});

	// TODO: Restore once postcss-markdown is PostCSS 8 compatible
	// eslint-disable-next-line jest/no-commented-out-tests
	// it('should work on markdown', async () => {
	// 	// Open the './test.md' file.
	// 	const mdDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.md'));

	// 	await window.showTextDocument(mdDocument);

	// 	// Wait for diagnostics result.
	// 	await pWaitFor(() => getStylelintDiagnostics(mdDocument.uri).length > 0, { timeout: 5000 });

	// 	expect(getStylelintDiagnostics(mdDocument.uri).map(normalizeDiagnostic)).toMatchSnapshot();
	// });
});
