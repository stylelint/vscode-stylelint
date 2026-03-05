import {
	openDocument,
	closeAllEditors,
	waitForDiagnostics,
	assertDiagnostics,
	itOnVersion,
} from '../helpers.js';

describe('Custom rule URL in configuration', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	itOnVersion(
		'>=16.7',
		'should use custom URL from rule configuration as codeDescription',
		async () => {
			const document = await openDocument('custom-rule-url/test.css');
			const diagnostics = await waitForDiagnostics(document);

			assertDiagnostics(diagnostics, [
				{
					code: 'color-hex-length',
					codeDescription: 'https://example.com/custom-color-hex-docs',
					message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
					range: [2, 9, 2, 13],
					severity: 'error',
				},
			]);
		},
	);
});
