import path from 'path';

import pWaitFor from 'p-wait-for';
import { workspace, window } from 'vscode';

import { normalizeDiagnostic, getStylelintDiagnostics } from '../utils';

const workspaceDir = path.join(__dirname, 'workspace');

describe('Linting', () => {
	it('should lint CSS documents', async () => {
		const cssDocument = await workspace.openTextDocument(path.resolve(workspaceDir, 'lint.css'));

		await window.showTextDocument(cssDocument);

		await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		expect(getStylelintDiagnostics(cssDocument.uri).map(normalizeDiagnostic)).toMatchSnapshot();
	});

	it('should display rule documentation links when one is available', async () => {
		const cssDocument = await workspace.openTextDocument(
			path.resolve(workspaceDir, 'rule-doc.css'),
		);

		await window.showTextDocument(cssDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		expect(getStylelintDiagnostics(cssDocument.uri).map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
