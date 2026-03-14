import * as assert from 'node:assert/strict';

import {
	openDocument,
	closeAllEditors,
	getStylelintDiagnostics,
	waitForDiagnostics,
} from '../helpers.js';

describe('.stylelintignore', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should have syntax highlighting', async () => {
		const { document } = await openDocument('defaults/.stylelintignore');

		assert.equal(document.languageId, 'ignore');
	});

	it('should be respected', async () => {
		const { document } = await openDocument('defaults/ignored.css');

		assert.deepEqual(getStylelintDiagnostics(document.uri), []);
	});

	it('should be respected when not directly in the workspace root', async () => {
		const { document: lintedDocument } = await openDocument(
			'ignore-cwd/packages/app/src/not-ignored.css',
		);
		const diagnostics = await waitForDiagnostics(lintedDocument);

		assert.ok(diagnostics.length > 0);

		const { document: ignoredDocument } = await openDocument(
			'ignore-cwd/packages/app/src/ignored.css',
		);

		assert.deepEqual(getStylelintDiagnostics(ignoredDocument.uri), []);
	});

	it('should ignore files in node_modules by default when opened in the editor', async () => {
		const { document } = await openDocument(
			'defaults/node_modules/stylelint-e2e-fixtures/ignored-by-default.css',
		);

		assert.deepEqual(getStylelintDiagnostics(document.uri), []);
	});
});
