import * as assert from 'node:assert/strict';

import { openDocument, closeAllEditors, getStylelintDiagnostics } from '../helpers';

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
});
