'use strict';

const path = require('path');
const pWaitFor = require('p-wait-for');
const { workspace, commands, window } = require('vscode');

describe('vscode-stylelint with "stylelint.customSyntax"', () => {
	it('autofix should work if "stylelint.customSyntax" is enabled', async () => {
		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

		// Wait until the Autofix command is available.
		await pWaitFor(
			async () => {
				const names = await commands.getCommands();

				return (
					names.includes('stylelint.executeAutofix') && names.includes('stylelint.applyAutoFix')
				);
			},
			{ timeout: 2000 },
		);

		// Execute the Autofix command.
		await commands.executeCommand('stylelint.executeAutofix');

		// Check the result.
		expect(cssDocument.getText()).toMatchSnapshot();
	});
});
