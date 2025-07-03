import { warningToDiagnostic } from '../warning-to-diagnostic';
import { DiagnosticSeverity } from 'vscode-languageserver-types';
import type { Warning } from 'stylelint';
import type { RuleCustomization } from '../../../server/types';

describe('warningToDiagnostic severity override', () => {
	const createWarning = (rule: string, severity: 'error' | 'warning' = 'error'): Warning => ({
		rule,
		severity,
		text: `Test message for ${rule}`,
		line: 1,
		column: 1,
	});

	test('should apply exact rule match customization', () => {
		const warning = createWarning('color-named', 'error');
		const customizations: RuleCustomization[] = [{ rule: 'color-named', severity: 'warn' }];

		const diagnostic = warningToDiagnostic(warning, undefined, customizations);

		expect(diagnostic).not.toBeNull();
		expect(diagnostic!.severity).toBe(DiagnosticSeverity.Warning);
	});

	test('should apply wildcard rule match customization', () => {
		const warning = createWarning('color-named', 'error');
		const customizations: RuleCustomization[] = [{ rule: 'color-*', severity: 'info' }];

		const diagnostic = warningToDiagnostic(warning, undefined, customizations);

		expect(diagnostic).not.toBeNull();
		expect(diagnostic!.severity).toBe(DiagnosticSeverity.Information);
	});

	test('should suppress diagnostic with "off" severity', () => {
		const warning = createWarning('color-named', 'error');
		const customizations: RuleCustomization[] = [{ rule: 'color-named', severity: 'off' }];

		const diagnostic = warningToDiagnostic(warning, undefined, customizations);

		expect(diagnostic).toBeNull();
	});

	test('should downgrade error to warning', () => {
		const warning = createWarning('color-named', 'error');
		const customizations: RuleCustomization[] = [{ rule: 'color-named', severity: 'downgrade' }];

		const diagnostic = warningToDiagnostic(warning, undefined, customizations);

		expect(diagnostic).not.toBeNull();
		expect(diagnostic!.severity).toBe(DiagnosticSeverity.Warning);
	});

	test('should upgrade warning to error', () => {
		const warning = createWarning('color-named', 'warning');
		const customizations: RuleCustomization[] = [{ rule: 'color-named', severity: 'upgrade' }];

		const diagnostic = warningToDiagnostic(warning, undefined, customizations);

		expect(diagnostic).not.toBeNull();
		expect(diagnostic!.severity).toBe(DiagnosticSeverity.Error);
	});

	test('should downgrade warning to info', () => {
		const warning = createWarning('color-named', 'warning');
		const customizations: RuleCustomization[] = [{ rule: 'color-named', severity: 'downgrade' }];

		const diagnostic = warningToDiagnostic(warning, undefined, customizations);

		expect(diagnostic).not.toBeNull();
		expect(diagnostic!.severity).toBe(DiagnosticSeverity.Information);
	});

	test('should not upgrade error when using upgrade', () => {
		const warning = createWarning('color-named', 'error');
		const customizations: RuleCustomization[] = [{ rule: 'color-named', severity: 'upgrade' }];

		const diagnostic = warningToDiagnostic(warning, undefined, customizations);

		expect(diagnostic).not.toBeNull();
		expect(diagnostic!.severity).toBe(DiagnosticSeverity.Error);
	});

	test('should use first matching customization', () => {
		const warning = createWarning('color-named', 'error');
		const customizations: RuleCustomization[] = [
			{ rule: 'color-named', severity: 'off' },
			{ rule: 'color-*', severity: 'info' },
			{ rule: 'color-named', severity: 'warn' },
		];

		const diagnostic = warningToDiagnostic(warning, undefined, customizations);

		expect(diagnostic).not.toBeNull();
		expect(diagnostic!.severity).toBe(DiagnosticSeverity.Warning);
	});

	test('should use original error severity when no customization matches', () => {
		const warning = createWarning('color-named', 'error');
		const customizations: RuleCustomization[] = [{ rule: 'font-family-*', severity: 'warn' }];

		const diagnostic = warningToDiagnostic(warning, undefined, customizations);

		expect(diagnostic).not.toBeNull();
		expect(diagnostic!.severity).toBe(DiagnosticSeverity.Error);
	});

	test('should use original warning severity when no customization matches', () => {
		const warning = createWarning('color-named', 'warning');
		const customizations: RuleCustomization[] = [{ rule: 'font-family-*', severity: 'error' }];

		const diagnostic = warningToDiagnostic(warning, undefined, customizations);

		expect(diagnostic).not.toBeNull();
		expect(diagnostic!.severity).toBe(DiagnosticSeverity.Warning);
	});

	test('should use original severity when no customizations provided', () => {
		const warningError = createWarning('color-named', 'error');
		const warningWarn = createWarning('color-named', 'warning');

		const diagnosticError = warningToDiagnostic(warningError, undefined, []);
		const diagnosticWarn = warningToDiagnostic(warningWarn, undefined, []);

		expect(diagnosticError).not.toBeNull();
		expect(diagnosticError!.severity).toBe(DiagnosticSeverity.Error);
		expect(diagnosticWarn).not.toBeNull();
		expect(diagnosticWarn!.severity).toBe(DiagnosticSeverity.Warning);
	});

	test('should handle complex wildcard patterns', () => {
		const warning1 = createWarning('declaration-block-no-duplicate-properties', 'error');
		const warning2 = createWarning('block-no-empty', 'error');
		const warning3 = createWarning('color-named', 'error');

		const customizations: RuleCustomization[] = [
			{ rule: '*-block-*', severity: 'warn' },
			{ rule: 'block-*', severity: 'info' },
			{ rule: 'color-*', severity: 'warn' },
		];

		const diagnostic1 = warningToDiagnostic(warning1, undefined, customizations);
		const diagnostic2 = warningToDiagnostic(warning2, undefined, customizations);
		const diagnostic3 = warningToDiagnostic(warning3, undefined, customizations);

		expect(diagnostic1).not.toBeNull();
		expect(diagnostic1!.severity).toBe(DiagnosticSeverity.Warning);

		expect(diagnostic2).not.toBeNull();
		expect(diagnostic2!.severity).toBe(DiagnosticSeverity.Information);

		expect(diagnostic3).not.toBeNull();
		expect(diagnostic3!.severity).toBe(DiagnosticSeverity.Warning);
	});

	test('should apply negation pattern - exact match', () => {
		const warning1 = createWarning('color-named', 'error');
		const warning2 = createWarning('font-family-no-missing-generic-family-keyword', 'error');

		const customizations: RuleCustomization[] = [{ rule: '!color-named', severity: 'warn' }];

		const diagnostic1 = warningToDiagnostic(warning1, undefined, customizations);
		const diagnostic2 = warningToDiagnostic(warning2, undefined, customizations);

		// color-named should NOT match.
		expect(diagnostic1).not.toBeNull();
		expect(diagnostic1!.severity).toBe(DiagnosticSeverity.Error);

		// font-family rule SHOULD match negation.
		expect(diagnostic2).not.toBeNull();
		expect(diagnostic2!.severity).toBe(DiagnosticSeverity.Warning);
	});

	test('should apply negation pattern - wildcard', () => {
		const warning1 = createWarning('color-named', 'error');
		const warning2 = createWarning('color-hex-length', 'error');
		const warning3 = createWarning('font-family-no-missing-generic-family-keyword', 'error');

		const customizations: RuleCustomization[] = [{ rule: '!color-*', severity: 'info' }];

		const diagnostic1 = warningToDiagnostic(warning1, undefined, customizations);
		const diagnostic2 = warningToDiagnostic(warning2, undefined, customizations);
		const diagnostic3 = warningToDiagnostic(warning3, undefined, customizations);

		// color-* rules should NOT match, keeping their original severity.
		expect(diagnostic1).not.toBeNull();
		expect(diagnostic1!.severity).toBe(DiagnosticSeverity.Error);
		expect(diagnostic2).not.toBeNull();
		expect(diagnostic2!.severity).toBe(DiagnosticSeverity.Error);

		// non-color rule SHOULD match negation and be overridden.
		expect(diagnostic3).not.toBeNull();
		expect(diagnostic3!.severity).toBe(DiagnosticSeverity.Information);
	});

	test('should handle negation pattern with "off" severity', () => {
		const warning1 = createWarning('color-named', 'error');
		const warning2 = createWarning('font-family-no-missing-generic-family-keyword', 'error');

		const customizations: RuleCustomization[] = [{ rule: '!color-*', severity: 'off' }];

		const diagnostic1 = warningToDiagnostic(warning1, undefined, customizations);
		const diagnostic2 = warningToDiagnostic(warning2, undefined, customizations);

		// color-* rules should NOT match.
		expect(diagnostic1).not.toBeNull();
		expect(diagnostic1!.severity).toBe(DiagnosticSeverity.Error);

		// non-color rule SHOULD match negation and get suppressed.
		expect(diagnostic2).toBeNull();
	});

	test('should prioritize first matching rule with negation patterns', () => {
		const warning = createWarning('font-family-no-missing-generic-family-keyword', 'error');

		const customizations: RuleCustomization[] = [
			{ rule: '!color-*', severity: 'info' },
			{ rule: 'font-*', severity: 'warn' },
		];

		const diagnostic = warningToDiagnostic(warning, undefined, customizations);

		expect(diagnostic).not.toBeNull();
		expect(diagnostic!.severity).toBe(DiagnosticSeverity.Warning);
	});

	test('should handle complex negation patterns', () => {
		const warning1 = createWarning('declaration-block-no-duplicate-properties', 'error');
		const warning2 = createWarning('block-no-empty', 'error');
		const warning3 = createWarning('color-named', 'error');

		const customizations: RuleCustomization[] = [{ rule: '!*-block-*', severity: 'info' }];

		const diagnostic1 = warningToDiagnostic(warning1, undefined, customizations);
		const diagnostic2 = warningToDiagnostic(warning2, undefined, customizations);
		const diagnostic3 = warningToDiagnostic(warning3, undefined, customizations);

		// declaration-block-no-duplicate-properties matches *-block-*, so should NOT
		// match !*-block-*.
		expect(diagnostic1).not.toBeNull();
		expect(diagnostic1!.severity).toBe(DiagnosticSeverity.Error);

		// block-no-empty does NOT match *-block-* since there is no dash before "block",
		// so SHOULD match !*-block-*.
		expect(diagnostic2).not.toBeNull();
		expect(diagnostic2!.severity).toBe(DiagnosticSeverity.Information);

		// color-named does NOT match *-block-*, so SHOULD match !*-block-*.
		expect(diagnostic3).not.toBeNull();
		expect(diagnostic3!.severity).toBe(DiagnosticSeverity.Information);
	});

	test('should handle unknown severity override gracefully', () => {
		const warning = createWarning('color-named', 'error');

		// Create a customization with an invalid severity override.
		const customizations: RuleCustomization[] = [
			{
				rule: 'color-named',
				severity: 'unknown-severity' as unknown as RuleCustomization['severity'],
			},
		];

		// Mock console.warn to verify it gets called.
		const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

		const diagnostic = warningToDiagnostic(warning, undefined, customizations);

		expect(consoleWarnSpy).toHaveBeenCalledWith('Unknown severity override: unknown-severity');
		expect(diagnostic).not.toBeNull();
		expect(diagnostic!.severity).toBe(DiagnosticSeverity.Error); // Should fallback to original severity.

		consoleWarnSpy.mockRestore();
	});

	test('should apply error severity override', () => {
		const warning = createWarning('test-rule', 'warning');
		const customizations: RuleCustomization[] = [{ rule: 'test-rule', severity: 'error' }];

		const result = warningToDiagnostic(warning, undefined, customizations);

		expect(result).not.toBeNull();
		expect(result!.severity).toBe(DiagnosticSeverity.Error);
	});

	test('should use default severity when override is "default"', () => {
		const warningError = createWarning('color-named', 'error');
		const warningWarn = createWarning('font-family-name', 'warning');
		const customizations: RuleCustomization[] = [
			{ rule: 'color-*', severity: 'info' },
			{ rule: 'font-family-name', severity: 'default' },
			{ rule: 'color-named', severity: 'default' },
		];

		const diagnosticError = warningToDiagnostic(warningError, undefined, customizations);
		const diagnosticWarn = warningToDiagnostic(warningWarn, undefined, customizations);

		expect(diagnosticError).not.toBeNull();
		expect(diagnosticError!.severity).toBe(DiagnosticSeverity.Error);
		expect(diagnosticWarn).not.toBeNull();
		expect(diagnosticWarn!.severity).toBe(DiagnosticSeverity.Warning);
	});
});
