import * as assert from 'node:assert/strict';

import { commands, languages } from 'vscode';

import { openDocument, waitForDiagnostics, closeAllEditors } from '../helpers.js';

describe('Restart command', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should restart the language server', async () => {
		const { document } = await openDocument('defaults/restart.css');
		const diagnostics1 = await waitForDiagnostics(document);

		await commands.executeCommand('stylelint.restart');

		assert.equal(languages.getDiagnostics(document.uri).length, 0);

		const diagnostics2 = await waitForDiagnostics(document, { timeout: 20000 });

		assert.deepEqual(diagnostics2, diagnostics1);
	});
});
