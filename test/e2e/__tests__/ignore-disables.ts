import { openDocument, waitForDiagnostics, assertDiagnostics, closeAllEditors } from '../helpers';

describe('"stylelint.ignoreDisables" setting', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should ignore disable directives when enabled', async () => {
		const document = await openDocument('ignore-disables/test.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'color-hex-case',
				codeDescription: 'https://stylelint.io/user-guide/rules/color-hex-case',
				message: 'Expected "#fff" to be "#FFF" (color-hex-case)',
				range: [3, 9, 3, 10],
				severity: 'error',
			},
			{
				code: 'indentation',
				codeDescription: 'https://stylelint.io/user-guide/rules/indentation',
				message: 'Expected indentation of 4 spaces (indentation)',
				range: [3, 2, 3, 14],
				severity: 'error',
			},
		]);
	});
});
