'use strict';

const path = require('path');

const pWaitFor = require('p-wait-for');
const { workspace, window, commands } = require('vscode');

const { normalizeDiagnostic, getStylelintDiagnostics } = require('../utils');

describe('vscode-stylelint with "stylelint.validate"', () => {
	beforeAll(async () => {
		await pWaitFor(
			async () => {
				const names = await commands.getCommands();

				return (
					names.includes('stylelint.executeAutofix') && names.includes('stylelint.applyAutoFix')
				);
			},
			{ timeout: 2000 },
		);
	});

	it('should be ignored lint and autofix on css', async () => {
		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

		// Wait for diagnostics result.
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Check the result.
		expect(getStylelintDiagnostics(cssDocument.uri)).toEqual([]);

		// Execute the Autofix command.
		await commands.executeCommand('stylelint.executeAutofix');

		// Check the result.
		expect(cssDocument.getText()).toMatchSnapshot();
	});

	it('should be ignored lint and autofix on scss', async () => {
		// Open the './test.scss' file.
		const scssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.scss'));

		await window.showTextDocument(scssDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => getStylelintDiagnostics(scssDocument.uri).length > 0, { timeout: 5000 });

		// Check the result.
		expect(getStylelintDiagnostics(scssDocument.uri).map(normalizeDiagnostic)).toMatchSnapshot();

		// Execute the Autofix command.
		await commands.executeCommand('stylelint.executeAutofix');

		// Check the result.
		expect(scssDocument.getText()).toMatchSnapshot();
	});

	it('should be ignored lint and autofix on markdown', async () => {
		// Open the './test.md' file.
		const mdDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.md'));

		await window.showTextDocument(mdDocument);

		// Wait for diagnostics result.
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Check the result.
		expect(getStylelintDiagnostics(mdDocument.uri)).toEqual([]);

		// Execute the Autofix command.
		await commands.executeCommand('stylelint.executeAutofix');

		// Check the result.
		expect(mdDocument.getText()).toMatchSnapshot();
	});
});
