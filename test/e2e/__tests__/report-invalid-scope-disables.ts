import { openDocument, waitForDiagnostics, assertDiagnostics, closeAllEditors } from '../helpers';

describe('"stylelint.reportInvalidScopeDisables" setting', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should report invalid-scope disables when enabled', async () => {
		const { document } = await openDocument('report-disables/invalid-scope.css');
		const diagnostics = (await waitForDiagnostics(document)).filter(
			({ code }) => code === '--report-invalid-scope-disables',
		);

		assertDiagnostics(diagnostics, [
			{
				code: '--report-invalid-scope-disables',
				message: 'Rule "foo" isn\'t enabled',
				range: [0, 0, 0, 36],
				severity: 'error',
			},
			{
				code: '--report-invalid-scope-disables',
				message: 'Rule "foo" isn\'t enabled',
				range: [2, 0, 2, 31],
				severity: 'error',
			},
			{
				code: '--report-invalid-scope-disables',
				message: 'Rule "foo" isn\'t enabled',
				range: [4, 0, 4, 26],
				severity: 'error',
			},
		]);
	});
});
