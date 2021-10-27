'use strict';

const { Diagnostic, DiagnosticSeverity, Position, Range } = require('vscode-languageserver-types');

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
 * @param {stylelint.Warning} warning The warning to convert.
 * @param {{[name: string]: stylelint.Rule}} [rules] Available Stylelint rules.
 * @returns {Diagnostic}
 */
function warningToDiagnostic(warning, rules) {
	const position = Position.create(warning.line - 1, warning.column - 1);

	const ruleDocUrl =
		rules?.[warning.rule] && `https://stylelint.io/user-guide/rules/${warning.rule}`;

	const diagnostic = Diagnostic.create(
		Range.create(position, position),
		warning.text,
		DiagnosticSeverity[warning.severity === 'warning' ? 'Warning' : 'Error'],
		warning.rule,
		'Stylelint',
	);

	if (ruleDocUrl) {
		diagnostic.codeDescription = { href: ruleDocUrl };
	}

	return diagnostic;
}

module.exports = {
	warningToDiagnostic,
};
