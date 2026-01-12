import {
	openDocument,
	waitForDiagnostics,
	assertDiagnostics,
	closeAllEditors,
	matchVersion,
} from '../helpers.js';

describe('Severity Override', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should override rule severities according to customizations', async () => {
		const document = await openDocument('severity-override/severity-override.css');
		const diagnostics = await waitForDiagnostics(document);

		// color-named rule should be downgraded from error to warning.
		// color-hex-length rule should be downgraded from error to info.
		// block-no-empty rule should be suppressed, i.e. off.
		// comment-empty-line-before rule should be downgraded from error to info, affected by !font-* negation.
		// custom-property-no-missing-var-function rule should be downgraded from error to warning.
		// declaration-block-no-duplicate-properties should be upgraded from warning to error.
		// font-family-no-missing-generic-family-keyword should keep error, not affected by !font-* negation.
		// length-zero-no-unit should use default error severity.

		assertDiagnostics(diagnostics, [
			{
				code: 'color-hex-length',
				message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
				range: [8, 9, 8, 13],
				severity: 'info', // Overridden from error to info.
			},
			{
				code: 'color-named',
				message: 'Unexpected named color "red" (color-named)',
				range: [4, 9, 4, 12],
				severity: 'warning', // Overridden from error to warning.
			},
			// block-no-empty should be suppressed, i.e. not present in diagnostics.
			{
				code: 'comment-empty-line-before',
				message: 'Expected empty line before comment (comment-empty-line-before)',
				range: [26, 0, 26, 70],
				severity: 'info', // Affected by !font-* negation (non-font rule gets downgraded).
			},
			{
				code: 'custom-property-no-missing-var-function',
				message:
					'Unexpected missing var function for "--my-var" (custom-property-no-missing-var-function)',
				range: [15, 9, 15, 17],
				severity: 'warning', // Downgraded from error.
			},
			{
				code: 'declaration-block-no-duplicate-properties',
				message: 'Unexpected duplicate "color" (declaration-block-no-duplicate-properties)',
				range: matchVersion({
					'<16': [20, 2, 20, 7],
					default: [19, 2, 19, 7],
				}),
				severity: 'error', // Upgraded from warning.
			},
			{
				code: 'font-family-no-missing-generic-family-keyword',
				message:
					'Unexpected missing generic font family (font-family-no-missing-generic-family-keyword)',
				range: [24, 15, 24, 20],
				severity: 'error', // Not affected by !font-* negation (font rules excluded).
			},
			{
				code: 'length-zero-no-unit',
				message: 'Unexpected unit (length-zero-no-unit)',
				range: [29, 10, 29, 12],
				severity: 'error', // Uses default severity, i.e. the original one from Stylelint.
			},
		]);
	});
});
