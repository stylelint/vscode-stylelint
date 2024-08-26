import { openDocument, waitForDiagnostics, assertDiagnostics, closeAllEditors } from '../helpers';

describe('Stylelint resolution', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should resolve Stylelint using local node_modules', async () => {
		const document = await openDocument('defaults/local-stylelint/test.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'fake',
				message: 'Fake result from resolve-local',
				range: [0, 0, 0, 1],
				severity: 'error',
			},
		]);
	});

	describe('when using "stylelint.stylelintPath"', () => {
		it('should resolve Stylelint', async () => {
			const document = await openDocument('stylelint-path/test.css');
			const diagnostics = await waitForDiagnostics(document);

			assertDiagnostics(diagnostics, [
				{
					code: 'fake',
					message: 'Fake result',
					range: [0, 0, 0, 1],
					severity: 'error',
				},
			]);
		});
	});

	it('should resolve Stylelint using PnP', async () => {
		const document = await openDocument('defaults/yarn-pnp/test.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'fake',
				message: 'Fake result from yarn-pnp',
				range: [0, 0, 0, 1],
				severity: 'error',
			},
		]);
	});

	it('should resolve Stylelint using Yarn 2.x PnP', async () => {
		const document = await openDocument('defaults/yarn-2-pnp/test.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'fake',
				message: 'Fake result from yarn-2-pnp',
				range: [0, 0, 0, 1],
				severity: 'error',
			},
		]);
	});
});
