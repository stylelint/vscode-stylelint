import path from 'path';

import pWaitFor from 'p-wait-for';
import { workspace, window } from 'vscode';

import { normalizeDiagnostic, getStylelintDiagnostics } from '../utils';

const workspaceDir = path.join(__dirname, 'workspace/local-stylelint');

describe('Local Stylelint resolution', () => {
	it('should resolve to the locally installed copy of Stylelint', async () => {
		const cssDocument = await workspace.openTextDocument(path.resolve(workspaceDir, 'test.css'));

		await window.showTextDocument(cssDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		// Check the result.
		const diagnostics = getStylelintDiagnostics(cssDocument.uri);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
