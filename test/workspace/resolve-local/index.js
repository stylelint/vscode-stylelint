'use strict';

const path = require('path');

const pWaitFor = require('p-wait-for');
const { workspace, window } = require('vscode');

const { normalizeDiagnostic, getStylelintDiagnostics } = require('../utils');

describe('Local Stylelint resolution', () => {
	it('should work even if "stylelint.stylelintPath" is defined', async () => {
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
