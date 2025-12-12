import {
	openDocument,
	waitForDiagnostics,
	assertDiagnostics,
	closeAllEditors,
} from '../helpers.js';

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
				message: 'Disable for "color-hex-length" is missing a description',
				range: [2, 4, 2, 53],
				severity: 'error',
			},
		]);
	});
});
