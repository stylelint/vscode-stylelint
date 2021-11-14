import path from 'path';
import pWaitFor from 'p-wait-for';
import { commands } from 'vscode';
import { normalizeDiagnostic, getStylelintDiagnostics } from '../utils';

describe('"stylelint.validate" setting', () => {
	beforeAll(async () => {
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
	});

	describe('when set to ["scss"]', () => {
		it("shouldn't lint or fix css", async () => {
			const { document } = await openDocument(path.resolve(workspaceDir, 'validate/test.css'));

			// TODO: find a better way to wait for linting to finish
			await new Promise((resolve) => setTimeout(resolve, 2000));

			expect(getStylelintDiagnostics(document.uri)).toEqual([]);

			// cspell:disable-next-line
			await commands.executeCommand('stylelint.executeAutofix');

			expect(document.getText()).toMatchSnapshot();
		});

		it('should lint and auto-fix scss', async () => {
			const { document } = await openDocument(path.resolve(workspaceDir, 'validate/test.scss'));
			const diagnostics = await waitForDiagnostics(document);

			expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();

			// cspell:disable-next-line
			await commands.executeCommand('stylelint.executeAutofix');

			expect(document.getText()).toMatchSnapshot();
		});

		it("shouldn't lint or fix markdown", async () => {
			const { document } = await openDocument(path.resolve(workspaceDir, 'validate/test.md'));

			// TODO: find a better way to wait for linting to finish
			await new Promise((resolve) => setTimeout(resolve, 2000));

			expect(getStylelintDiagnostics(document.uri)).toEqual([]);

			// cspell:disable-next-line
			await commands.executeCommand('stylelint.executeAutofix');

			expect(document.getText()).toMatchSnapshot();
		});
	});
});
