import {
	openDocument,
	waitForDiagnostics,
	assertDiagnostics,
	closeAllEditors,
} from '../helpers.js';

describe('"stylelint.ignoreDisables" setting', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should ignore disable directives when enabled', async () => {
		const document = await openDocument('ignore-disables/test.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'color-hex-length',
				codeDescription: 'https://stylelint.io/user-guide/rules/color-hex-length',
				message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
				range: [3, 14, 3, 18],
				severity: 'error',
			},
		]);
	});
});
