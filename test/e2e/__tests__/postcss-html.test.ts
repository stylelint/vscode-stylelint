import * as assert from 'node:assert/strict';

import { assertDiagnostic, closeAllEditors, openDocument, waitForDiagnostics } from '../helpers.js';

describe('postcss-html', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('lints a Vue file', async () => {
		const { document } = await openDocument('postcss-html/test.vue');
		const diagnostics = await waitForDiagnostics(document);

		assert.equal(diagnostics.length, 1);
		assertDiagnostic(diagnostics[0], {
			code: 'color-no-hex',
			message: 'Unexpected hex color "#000" (color-no-hex)',
			range: [6, 9, 6, 13],
			severity: 'error',
		});
	});
});
