import path from 'path';

import pWaitFor from 'p-wait-for';
import { workspace, window } from 'vscode';

import { normalizeDiagnostic, getStylelintDiagnostics } from '../utils';

describe('vscode-stylelint with "stylelint.reportInvalidScopeDisables"', () => {
	it('should work if "stylelint.reportInvalidScopeDisables" is enabled', async () => {
		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

		// Wait for diagnostics result.
		await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		// Check the result.
		const diagnostics = getStylelintDiagnostics(cssDocument.uri);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
