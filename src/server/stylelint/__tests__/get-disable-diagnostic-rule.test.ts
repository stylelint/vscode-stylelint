import { Range } from 'vscode-languageserver-types';
import { DisableReportRuleNames } from '../types.js';
import { getDisableDiagnosticRule } from '../get-disable-diagnostic-rule.js';
import { describe, expect, test } from 'vitest';

const range = Range.create(0, 1, 2, 3);

describe('getDisableDiagnosticRule', () => {
	test('should return rules for needless disable diagnostics', () => {
		expect(
			getDisableDiagnosticRule({
				message: 'Needless disable for "color-named"',
				range,
				code: DisableReportRuleNames.Needless,
			}),
		).toBe('color-named');
	});

	test('should return rules for invalid scope disable diagnostics', () => {
		expect(
			getDisableDiagnosticRule({
				message: 'Rule "block-no-empty" isn\'t enabled',
				range,
				code: DisableReportRuleNames.InvalidScope,
			}),
		).toBe('block-no-empty');
	});

	test('should return rules for description-less disable diagnostics', () => {
		expect(
			getDisableDiagnosticRule({
				message: 'Disable for "all" is missing a description',
				range,
				code: DisableReportRuleNames.Descriptionless,
			}),
		).toBe('all');
	});

	test('should return rules for illegal disable diagnostics', () => {
		expect(
			getDisableDiagnosticRule({
				message: 'Rule "block-no-empty" may not be disabled',
				range,
				code: DisableReportRuleNames.Illegal,
			}),
		).toBe('block-no-empty');
	});

	test('should return undefined for non-disable diagnostics', () => {
		expect(
			getDisableDiagnosticRule({
				message: 'Expected indentation of 4 spaces (indentation)',
				range,
				code: 'indentation',
			}),
		).toBeUndefined();
	});
});
