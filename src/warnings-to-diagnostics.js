'use strict';

const { Diagnostic, DiagnosticSeverity, Position, Range } = require('vscode-languageserver-types');

/** @type {RuleDocUrlProvider} */
const NOOP_RULE_DOC_URL_PROVIDER = () => undefined;

/**
 * @param {stylelint.Warning} warning
 * @param {RuleDocUrlProvider} [ruleDocUrlProvider]
 * @returns {Diagnostic}
 */
module.exports = function stylelintWarningToVscodeDiagnostic(
	warning,
	ruleDocUrlProvider = NOOP_RULE_DOC_URL_PROVIDER,
) {
	const position = Position.create(warning.line - 1, warning.column - 1);

	/**
	 * @type {lsp.URI | null | undefined}
	 */
	const ruleDocUrl = ruleDocUrlProvider(warning.rule);

	const diagnostic = Diagnostic.create(
		Range.create(position, position),
		warning.text,
		DiagnosticSeverity[warning.severity === 'warning' ? 'Warning' : 'Error'],
		warning.rule,
		'stylelint',
	);

	if (ruleDocUrl) {
		diagnostic.codeDescription = { href: ruleDocUrl };
	}

	return diagnostic;
};
