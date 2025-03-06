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
				message: 'Needless disable for "color-hex-length"',
				range: [2, 2, 2, 60],
				severity: 'error',
			},
			{
				code: '--report-needless-disables',
				message: 'Needless disable for "color-hex-length"',
				range: [6, 0, 6, 39],
				severity: 'error',
			},
			{
				code: '--report-needless-disables',
				message: 'Needless disable for "color-hex-length"',
				range: [14, 16, 14, 60],
				severity: 'error',
			},
			{
				code: '--report-needless-disables',
				message: 'Needless disable for "color-hex-length"',
				range: [17, 0, 17, 39],
				severity: 'error',
			},
			{
				code: '--report-needless-disables',
				message: 'Needless disable for "unknown"',
				range: [2, 2, 2, 60],
				severity: 'error',
			},
		]);
	});
});
