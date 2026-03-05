import * as assert from 'node:assert/strict';

import {
	openDocument,
	closeAllEditors,
	getStylelintDiagnostics,
	waitForDiagnostics,
	assertDiagnostics,
} from '../helpers.js';

describe('"stylelint.ignorePath" setting', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should use the specified file for ignore patterns', async () => {
		const { document: ignoredDocument } = await openDocument(
			'ignore-path/ignored-by-customignore.css',
		);

		assert.deepEqual(getStylelintDiagnostics(ignoredDocument.uri), []);
	});

	it('should lint files not matching the ignore patterns', async () => {
		const document = await openDocument('ignore-path/not-ignored.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'color-hex-length',
				codeDescription: 'https://stylelint.io/user-guide/rules/color-hex-length',
				message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
				range: [2, 8, 2, 12],
				severity: 'error',
			},
		]);
	});
});
