'use strict';

const path = require('path');

const pWaitFor = require('p-wait-for');
const { normalizeDiagnostic, getStylelintDiagnostics } = require('../utils');
const { workspace, window } = require('vscode');

describe('vscode-stylelint with "stylelint.configBasedir"', () => {
	it('should work even if "stylelint.configBasedir" is defined', async () => {
		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

		await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

		// Check the result.
		const diagnostics = getStylelintDiagnostics(cssDocument.uri);

		expect(diagnostics.map(normalizeDiagnostic)).toMatchSnapshot();
	});
});
