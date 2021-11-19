import path from 'path';
import { commands, languages } from 'vscode';

// Skipped for now because of https://github.com/microsoft/vscode-languageserver-node/issues/723
// Should work with LSP 3.17 when released
// eslint-disable-next-line jest/no-disabled-tests
describe.skip('Restart command', () => {
	it('should restart the language server', async () => {
		const { document } = await openDocument(path.resolve(workspaceDir, 'defaults/lint.css'));
		const diagnostics1 = await waitForDiagnostics(document);

		await commands.executeCommand('stylelint.restart');

		expect(languages.getDiagnostics(document.uri)).toEqual([]);

		const diagnostics2 = await waitForDiagnostics(document);

		expect(diagnostics2).toEqual(diagnostics1);
	});
});
