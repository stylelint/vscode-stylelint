import path from 'path';

import pWaitFor from 'p-wait-for';
import { normalizeDiagnostic, getStylelintDiagnostics } from '../utils';
import { workspace, window } from 'vscode';

describe('vscode-stylelint with "stylelint.configBasedir"', () => {
	it('should work even if "stylelint.configBasedir" is defined', async () => {
		const cssDocument = await workspace.openTextDocument(
			path.resolve(workspaceDir, 'config/config-basedir.css'),
		);

		await window.showTextDocument(cssDocument);

		await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		const diagnostics = getStylelintDiagnostics(cssDocument.uri);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
