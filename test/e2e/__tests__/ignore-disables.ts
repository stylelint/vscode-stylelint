import path from 'path';

import pWaitFor from 'p-wait-for';
import { workspace, window } from 'vscode';

import { normalizeDiagnostic, getStylelintDiagnostics } from '../utils';

describe('vscode-stylelint with "stylelint.ignoreDisables"', () => {
	it('should work if "stylelint.ignoreDisables" is enabled', async () => {
		const cssDocument = await workspace.openTextDocument(
			path.resolve(workspaceDir, 'ignore-disables/test.css'),
		);

		await window.showTextDocument(cssDocument);

		await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		const diagnostics = getStylelintDiagnostics(cssDocument.uri);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
