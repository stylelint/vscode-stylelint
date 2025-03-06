import path from 'path';
import pWaitFor from 'p-wait-for';
import { commands } from 'vscode';

describe('"stylelint.customSyntax" setting', () => {
	it('should auto-fix using the specified custom syntax', async () => {
		const { document } = await openDocument(path.resolve(workspaceDir, 'custom-syntax/test.css'));

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

		expect(document.getText()).toMatchSnapshot();
	}, 10000);
});
