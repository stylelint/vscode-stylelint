import * as assert from 'node:assert/strict';

import { openDocument, executeAutofix, closeAllEditors } from '../helpers';

describe('"stylelint.customSyntax" setting', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should auto-fix using the specified custom syntax', async () => {
		const { document } = await openDocument('custom-syntax/test.css');

		await executeAutofix();

		assert.equal(
			document.getText(),
			`/* prettier-ignore */
.foo .bar
    color: red`,
		);
	});
});
