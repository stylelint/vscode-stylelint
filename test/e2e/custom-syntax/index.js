'use strict';

const path = require('path');
const pWaitFor = require('p-wait-for');
const { workspace, commands, window } = require('vscode');

describe('vscode-stylelint with "stylelint.customSyntax"', () => {
	it('auto-fix should work if "stylelint.customSyntax" is enabled', async () => {
		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

		// Wait until the Auto-fix command is available.
		await pWaitFor(
			async () => {
				const names = await commands.getCommands();

				return (
					// cspell:disable-next-line
					names.includes('stylelint.executeAutofix') && names.includes('stylelint.applyAutoFix')
				);
			},
			{ timeout: 2000 },
		);

		// Execute the Auto-fix command.
		// cspell:disable-next-line
		await commands.executeCommand('stylelint.executeAutofix');

		// Check the result.
		expect(cssDocument.getText()).toMatchSnapshot();
	});
});
