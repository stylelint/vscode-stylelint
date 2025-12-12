import {
	openDocument,
	waitForDiagnostics,
	assertDiagnostics,
	closeAllEditors,
} from '../helpers.js';

describe('"stylelint.configFile" setting', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should resolve the config file using the specified path', async () => {
		const document = await openDocument('config/config-file.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'block-no-empty',
				codeDescription: 'https://stylelint.io/user-guide/rules/block-no-empty',
				message: 'Unexpected empty block (block-no-empty)',
				range: [0, 2, 0, 4],
				severity: 'error',
			},
		]);
	});
});
