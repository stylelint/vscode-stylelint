import { Diagnostic, DiagnosticSeverity, Position, Range } from 'vscode-languageserver-types';
import type stylelint from 'stylelint';
import type { RuleCustomization, SeverityOverride } from '../../server/types';

/**
 * Converts a severity override value to LSP DiagnosticSeverity. Internal method
 * that only handles direct overrides, not 'upgrade' or 'downgrade'.
 */
function severityOverrideToLSPSeverity(
	override: Exclude<SeverityOverride, 'upgrade' | 'downgrade' | 'default'>,
): DiagnosticSeverity | null {
	switch (override) {
		case 'error':
			return DiagnosticSeverity.Error;
		case 'warn':
			return DiagnosticSeverity.Warning;
		case 'info':
			return DiagnosticSeverity.Information;
		case 'off':
			return null; // null means diagnostic should be suppressed.
	}
}

/**
 * Applies severity customizations to a warning.
 */
function applySeverityCustomization(
	warning: stylelint.Warning,
	ruleCustomizations?: RuleCustomization[],
): DiagnosticSeverity | null {
	if (!ruleCustomizations || ruleCustomizations.length === 0) {
		// No customizations, use original severity.
		return DiagnosticSeverity[warning.severity === 'warning' ? 'Warning' : 'Error'];
	}

	// Find matching customization. Process rules in reverse order so that
	// subsequent rules have priority over previous ones.
	let customization: RuleCustomization | undefined;

	for (let i = ruleCustomizations.length - 1; i >= 0; i--) {
		const custom = ruleCustomizations[i];
		const pattern = custom.rule;

		// Check for negation pattern.
		const isNegated = pattern.startsWith('!');
		const actualPattern = isNegated ? pattern.slice(1) : pattern;

		let matches = false;

		// Simple pattern matching, exact match or glob-like matching.
		if (actualPattern === warning.rule) {
			matches = true;
		}
		// Basic wildcard support for patterns like "color-*" or "*-block-*".
		else if (actualPattern.includes('*')) {
			const regexPattern = actualPattern
				.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars.
				.replace(/\\\*/g, '.*'); // Replace escaped \* with .*
			const regex = new RegExp(`^${regexPattern}$`);

			matches = regex.test(warning.rule);
		}

		// For negated patterns, invert the match result.
		if (isNegated ? !matches : matches) {
			customization = custom;
			break;
		}
	}

	if (!customization) {
		// No matching customization, use original severity.
		return DiagnosticSeverity[warning.severity === 'warning' ? 'Warning' : 'Error'];
	}

	const override = customization.severity;
	const originalSeverity = DiagnosticSeverity[warning.severity === 'warning' ? 'Warning' : 'Error'];

	// Handle special override types.
	switch (override) {
		case 'downgrade':
			return originalSeverity === DiagnosticSeverity.Error
				? DiagnosticSeverity.Warning
				: DiagnosticSeverity.Information;
		case 'upgrade':
			// Convert warning to error, error stays error.
			return originalSeverity === DiagnosticSeverity.Warning
				? DiagnosticSeverity.Error
				: originalSeverity;
		case 'default':
			// Use the original severity from Stylelint.
			return originalSeverity;
		case 'off':
		case 'warn':
		case 'info':
		case 'error':
			// Direct severity mapping.
			return severityOverrideToLSPSeverity(override);
		default:
			// If we reach this branch, the override is not recognized.
			console.warn(`Unknown severity override: ${String(override)}`);

			return originalSeverity; // Fallback to original severity.
	}
}

/**
 * Converts a Stylelint warning to an LSP Diagnostic.
 *
 * @example
 * ```js
 * const [result] = await stylelint.lint({
 *   code: 'a { color: red; }',
 *   config: { rules: { 'color-named': 'never' } }
 * });
 *
 * const [warning] = result.warnings;
 * // {
 * //   rule: 'color-named',
 * //   text: 'Unexpected named color "red" (color-named)',
 * //   severity: 'error',
 * //   line: 1,
 * //   column: 12
 * // }
 *
 * const diagnostic = warningToDiagnostic(warning);
 * // {
 * //   message: 'Unexpected named color "red" (color-named)',
 * //   severity: 1,
 * //   source: 'Stylelint',
 * //   range: {
 * //     start: {
 * //       line: 0,
 * //       character: 11
 * //     },
 * //     end: {
 * //       line: 0,
 * //       character: 11
 * //     }
 * //   }
 * // }
 * ```
 * @param warning The warning to convert.
 * @param ruleMetadata Available Stylelint rules.
 * @param ruleCustomizations Optional rule customizations for severity overrides.
 */
export function warningToDiagnostic(
	warning: stylelint.Warning,
	ruleMetadata?: stylelint.LinterResult['ruleMetadata'],
	ruleCustomizations?: RuleCustomization[],
): Diagnostic | null {
	const severity = applySeverityCustomization(warning, ruleCustomizations);

	// If severity is null, the diagnostic should be suppressed.
	if (severity === null) {
		return null;
	}

	const start = Position.create(warning.line - 1, warning.column - 1);
	const end =
		typeof warning.endLine === 'number' && typeof warning.endColumn === 'number'
			? Position.create(warning.endLine - 1, warning.endColumn - 1)
			: Position.create(warning.line - 1, warning.column);

	const ruleDocUrl = ruleMetadata?.[warning.rule]?.url;

	const diagnostic = Diagnostic.create(
		Range.create(start, end),
		warning.text,
		severity,
		warning.rule,
		'Stylelint',
	);

	if (ruleDocUrl) {
		diagnostic.codeDescription = { href: ruleDocUrl };
	}

	return diagnostic;
}
