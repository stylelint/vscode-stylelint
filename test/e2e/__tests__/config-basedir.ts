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
				code: 'color-hex-case',
				codeDescription: 'https://stylelint.io/user-guide/rules/color-hex-case',
				message: 'Expected "#fff" to be "#FFF" (color-hex-case)',
				range: [1, 9, 1, 10],
				severity: 'error',
			},
			{
				code: 'indentation',
				codeDescription: 'https://stylelint.io/user-guide/rules/indentation',
				message: 'Expected indentation of 8 spaces (indentation)',
				range: [1, 2, 1, 14],
				severity: 'error',
			},
		]);
	});
});
