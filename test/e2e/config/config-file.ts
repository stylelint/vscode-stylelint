import path from 'path';
import pWaitFor from 'p-wait-for';
import { workspace, window } from 'vscode';

import { normalizeDiagnostic, getStylelintDiagnostics } from '../utils';

const workspaceDir = path.join(__dirname, 'workspace');

describe('vscode-stylelint with "stylelint.configFile"', () => {
	it('should work even if "stylelint.configFile" is defined', async () => {
		const cssDocument = await workspace.openTextDocument(
			path.resolve(workspaceDir, 'config-file.css'),
		);

		await window.showTextDocument(cssDocument);

		await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		const diagnostics = getStylelintDiagnostics(cssDocument.uri);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
