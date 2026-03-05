import * as assert from 'node:assert/strict';

import {
	openDocument,
	closeAllEditors,
	getStylelintDiagnostics,
	restoreFile,
	sleep,
	waitForDiagnostics,
	assertDiagnostics,
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

			assert.deepEqual(getStylelintDiagnostics(editor.document.uri), []);

			const success = await editor.edit((editBuilder) => {
				editBuilder.replace(new Range(new Position(2, 9), new Position(2, 16)), '#fff');
			});

			assert.ok(success, 'Edit should succeed');

			await sleep(500);

			assert.deepEqual(
				getStylelintDiagnostics(editor.document.uri),
				[],
				'No new diagnostics should appear while typing when run is onSave',
			);

			await editor.document.save();

			const diagnostics = await waitForDiagnostics(editor);

			assertDiagnostics(diagnostics, [
				{
					code: 'color-hex-length',
					codeDescription: 'https://stylelint.io/user-guide/rules/color-hex-length',
					message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
					range: [2, 9, 2, 13],
					severity: 'error',
				},
			]);
		});
	});
});
