import path from 'path';
import pWaitFor from 'p-wait-for';
import { workspace, commands, window } from 'vscode';

describe('vscode-stylelint with "stylelint.customSyntax"', () => {
	it('auto-fix should work if "stylelint.customSyntax" is enabled', async () => {
		const cssDocument = await workspace.openTextDocument(
			path.resolve(workspaceDir, 'custom-syntax/test.css'),
		);

		await window.showTextDocument(cssDocument);

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

		// cspell:disable-next-line
		await commands.executeCommand('stylelint.executeAutofix');

		expect(cssDocument.getText()).toMatchSnapshot();
	});
});
