import { openDocument, waitForDiagnostics, assertDiagnostics, closeAllEditors } from '../helpers';

describe('Linting', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should lint CSS documents', async () => {
		const document = await openDocument('defaults/lint.css');
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
	});

	it('should display rule documentation links when one is available', async () => {
		const document = await openDocument('defaults/rule-doc.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'plugin/foo-bar',
				message: 'Bar (plugin/foo-bar)',
				range: [0, 5, 0, 6],
				severity: 'error',
			},
			{
				code: 'color-hex-length',
				codeDescription: 'https://stylelint.io/user-guide/rules/color-hex-length',
				message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
				range: [2, 9, 2, 13],
				severity: 'error',
			},
			{
				code: 'color-no-invalid-hex',
				codeDescription: 'https://stylelint.io/user-guide/rules/color-no-invalid-hex',
				message: 'Unexpected invalid hex color "#y3" (color-no-invalid-hex)',
				range: [6, 11, 6, 14],
				severity: 'error',
			},
		]);
	});
});
