import { openDocument, waitForDiagnostics, assertDiagnostics, closeAllEditors } from '../helpers';

describe('"stylelint.reportDescriptionlessDisables" setting', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should report invalid-scope disables when enabled', async () => {
		const { document } = await openDocument('descriptionless-disables/test.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: '--report-descriptionless-disables',
				message: 'Disable for "indentation" is missing a description',
				range: [2, 4, 2, 48],
				severity: 'error',
			},
		]);
	});
});
