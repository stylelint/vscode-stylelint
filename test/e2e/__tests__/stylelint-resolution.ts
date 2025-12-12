import {
	openDocument,
	waitForDiagnostics,
	assertDiagnostics,
	closeAllEditors,
} from '../helpers.js';

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

	describe('when ESM Stylelint is available', () => {
		it('should resolve Stylelint using ESM module', async () => {
			const document = await openDocument('prefer-esm/test.css');
			const diagnostics = await waitForDiagnostics(document);

			assertDiagnostics(diagnostics, [
				{
					code: 'fake',
					message: 'Fake result from ESM',
					range: [0, 0, 0, 1],
					severity: 'error',
				},
			]);
		});
	});

	describe('Stylelint resolution using PnP', () => {
		afterEach(async () => {
			await closeAllEditors();
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

		it('should resolve Stylelint using Yarn PnP with ESM', async () => {
			const document = await openDocument('defaults/yarn-pnp-esm/test.css');
			const diagnostics = await waitForDiagnostics(document);

			assertDiagnostics(diagnostics, [
				{
					code: 'fake',
					message: 'Fake result from yarn-pnp-esm',
					range: [0, 0, 0, 1],
					severity: 'error',
				},
			]);
		});
	});
});
