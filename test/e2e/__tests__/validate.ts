import path from 'path';

import pWaitFor from 'p-wait-for';
import { workspace, window, commands } from 'vscode';

import { normalizeDiagnostic, getStylelintDiagnostics } from '../utils';

describe('vscode-stylelint with "stylelint.validate" set to ["scss"]', () => {
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

	it("shouldn't lint or fix css", async () => {
		const cssDocument = await workspace.openTextDocument(
			path.resolve(workspaceDir, 'validate/test.css'),
		);

		await window.showTextDocument(cssDocument);

		await new Promise((resolve) => setTimeout(resolve, 2000));

		expect(getStylelintDiagnostics(cssDocument.uri)).toEqual([]);

		// cspell:disable-next-line
		await commands.executeCommand('stylelint.executeAutofix');

		expect(cssDocument.getText()).toMatchSnapshot();
	});

	it('should lint and auto-fix scss', async () => {
		const scssDocument = await workspace.openTextDocument(
			path.resolve(workspaceDir, 'validate/test.scss'),
		);

		await window.showTextDocument(scssDocument);

		await pWaitFor(() => getStylelintDiagnostics(scssDocument.uri).length > 0, { timeout: 5000 });

		expect(getStylelintDiagnostics(scssDocument.uri).map(normalizeDiagnostic)).toMatchSnapshot();

		// cspell:disable-next-line
		await commands.executeCommand('stylelint.executeAutofix');

		expect(scssDocument.getText()).toMatchSnapshot();
	});

	it("shouldn't lint or fix markdown", async () => {
		const mdDocument = await workspace.openTextDocument(
			path.resolve(workspaceDir, 'validate/test.md'),
		);

		await window.showTextDocument(mdDocument);

		await new Promise((resolve) => setTimeout(resolve, 2000));

		expect(getStylelintDiagnostics(mdDocument.uri)).toEqual([]);

		// cspell:disable-next-line
		await commands.executeCommand('stylelint.executeAutofix');

		expect(mdDocument.getText()).toMatchSnapshot();
	});
});
