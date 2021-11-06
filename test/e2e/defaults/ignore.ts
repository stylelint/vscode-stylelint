import path from 'path';

// import pWaitFor from 'p-wait-for';
// import { window, workspace } from 'vscode';
import { workspace } from 'vscode';

// import { normalizeDiagnostic, getStylelintDiagnostics } from '../utils';

const workspaceDir = path.join(__dirname, 'workspace');

describe('.stylelintignore', () => {
	it('should have syntax highlighting', async () => {
		expect(
			(await workspace.openTextDocument(path.join(workspaceDir, '.stylelintignore'))).languageId,
		).toBe('ignore');
	});

	// TODO: Get .stylelintignore to work
	// eslint-disable-next-line jest/no-commented-out-tests
	// it('should be respected', async () => {
	// 	const cssDocument = await workspace.openTextDocument(path.resolve(workspaceDir, 'ignored.css'));

	// 	await window.showTextDocument(cssDocument);

	// 	await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

	// 	expect(getStylelintDiagnostics(cssDocument.uri).map(normalizeDiagnostic)).toEqual([]);
	// });
});
