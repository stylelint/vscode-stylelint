import { assertDiagnostics, waitForDiagnostics, openDocument, closeAllEditors } from '../helpers';

describe('"stylelint.configBasedir" setting', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should resolve referenced configs using the base directory', async () => {
		const document = await openDocument('config/config-basedir.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'color-hex-alpha',
				codeDescription: 'https://stylelint.io/user-guide/rules/color-hex-alpha',
				message: 'Expected alpha channel in "#fff" (color-hex-alpha)',
				range: [1, 9, 1, 13],
				severity: 'error',
			},
			{
				code: 'color-hex-length',
				codeDescription: 'https://stylelint.io/user-guide/rules/color-hex-length',
				message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
				range: [1, 9, 1, 13],
				severity: 'error',
			},
		]);
	});
});
