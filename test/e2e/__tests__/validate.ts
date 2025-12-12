import * as assert from 'node:assert/strict';

import {
	openDocument,
	waitForDiagnostics,
	assertDiagnostics,
	getStylelintDiagnostics,
	executeAutofix,
	closeAllEditors,
} from '../helpers.js';

describe('"stylelint.validate" setting', () => {
	describe('when set to ["scss"]', () => {
		afterEach(async () => {
			await closeAllEditors();
		});

		it("shouldn't lint or fix css", async () => {
			const { document } = await openDocument('validate/test.css');

			assert.deepEqual(getStylelintDiagnostics(document.uri), []);

			await executeAutofix();

			assert.equal(
				document.getText(),
				`/* prettier-ignore */
a {
  color: #fff;
}
`,
			);
		});

		it('should lint and auto-fix scss', async () => {
			const { document } = await openDocument('validate/test.scss');
			const diagnostics = await waitForDiagnostics(document);

			assertDiagnostics(diagnostics, [
				{
					code: 'color-hex-length',
					codeDescription: 'https://stylelint.io/user-guide/rules/color-hex-length',
					message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
					range: [2, 9, 2, 13],
					severity: 'error',
				},
			]);

			await executeAutofix();

			assert.equal(
				document.getText(),
				`/* prettier-ignore */
a {
  color: #ffffff;
}
`,
			);
		});

		it("shouldn't lint or fix markdown", async () => {
			const { document } = await openDocument('validate/test.md');

			assert.deepEqual(getStylelintDiagnostics(document.uri), []);

			await executeAutofix();

			assert.equal(
				document.getText(),
				`# title

\`\`\`css
a {
  color: #fff;
}
\`\`\`
`,
			);
		});
	});
});
