import * as assert from 'node:assert/strict';

import {
	openDocument,
	closeAllEditors,
	restoreFile,
	waitForDiagnostics,
	assertDiagnostics,
	waitForDiagnosticsLength,
} from '../helpers.js';

import { Range, Position } from 'vscode';

describe('"stylelint.run" setting', () => {
	describe('when set to "onSave"', () => {
		restoreFile('run/test.css');

		afterEach(async () => {
			await closeAllEditors();
		});

		it('should not lint on type, but should lint on save', async () => {
			const editor = await openDocument('run/test.css');

			const initialDiagnostics = await waitForDiagnostics(editor);

			assertDiagnostics(initialDiagnostics, [
				{
					code: 'color-hex-length',
					codeDescription: 'https://stylelint.io/user-guide/rules/color-hex-length',
					message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
					range: [2, 9, 2, 13],
					severity: 'error',
				},
			]);

			const success = await editor.edit((editBuilder) => {
				editBuilder.replace(new Range(new Position(2, 9), new Position(2, 13)), '#ffffff');
			});

			assert.ok(success, 'Edit should succeed');

			await waitForDiagnosticsLength(editor.document.uri, 1);

			await editor.document.save();

			await waitForDiagnosticsLength(editor.document.uri, 0);
		});
	});
});
