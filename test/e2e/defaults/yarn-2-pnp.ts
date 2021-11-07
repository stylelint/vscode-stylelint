import path from 'path';

import pWaitFor from 'p-wait-for';
import { workspace, window } from 'vscode';

import { normalizeDiagnostic, getStylelintDiagnostics } from '../utils';

const workspaceDir = path.join(__dirname, 'workspace/yarn-2-pnp');

describe('Yarn 2.x PnP Stylelint resolution', () => {
	it('should resolve Stylelint using PnP', async () => {
		const cssDocument = await workspace.openTextDocument(path.resolve(workspaceDir, 'test.css'));

		await window.showTextDocument(cssDocument);

		await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		const diagnostics = getStylelintDiagnostics(cssDocument.uri);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
