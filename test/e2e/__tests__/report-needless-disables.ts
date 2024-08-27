import { openDocument, waitForDiagnostics, assertDiagnostics, closeAllEditors } from '../helpers';

describe('"stylelint.reportNeedlessDisables" setting', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should report needless disables when enabled', async () => {
		const { document } = await openDocument('report-disables/needless.css');
		const diagnostics = (await waitForDiagnostics(document)).filter(
			({ code }) => code === '--report-needless-disables',
		);

		assertDiagnostics(diagnostics, [
			{
				code: '--report-needless-disables',
				message: 'Needless disable for "indentation"',
				range: [2, 2, 2, 55],
				severity: 'error',
			},
			{
				code: '--report-needless-disables',
				message: 'Needless disable for "indentation"',
				range: [6, 0, 6, 34],
				severity: 'error',
			},
			{
				code: '--report-needless-disables',
				message: 'Needless disable for "indentation"',
				range: [14, 16, 14, 55],
				severity: 'error',
			},
			{
				code: '--report-needless-disables',
				message: 'Needless disable for "indentation"',
				range: [17, 0, 17, 34],
				severity: 'error',
			},
			{
				code: '--report-needless-disables',
				message: 'Needless disable for "unknown"',
				range: [2, 2, 2, 55],
				severity: 'error',
			},
		]);
	});
});
