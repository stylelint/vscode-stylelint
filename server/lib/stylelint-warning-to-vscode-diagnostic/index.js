'use strict';

const inspectWithKind = require('../inspect-with-kind');
const { Diagnostic, DiagnosticSeverity, Position, Range } = require('vscode-languageserver-types');

/**
 * @typedef { import('stylelint').Severity } Severity
 * @typedef { { line: number, column: number, rule: string, severity: Severity, text: string } } Warning
 * @typedef { import('vscode-languageserver-types').URI } URI
 * @typedef { (rule: string) => (URI | null | undefined) } RuleDocUrlProvider
 */

/** @type {Set<'line' | 'column'>} */
const NUMBER_PROPERTIES = new Set(['line', 'column']);
/** @type {Set<'error' | 'warning'>} */
const VALID_SEVERITIES = new Set(['error', 'warning']);

const ARGUMENT_ERROR =
	'Expected a stylelint warning ({line: <number>, colum: <number>, rule: <string>, severity: <string>, text: <string>})';
const SEVERITY_ERROR =
	"`severity` property of a stylelint warning must be either 'error' or 'warning'";

/** @type {RuleDocUrlProvider} */
// @ts-ignore -- noop function
const NOOP_RULE_DOC_URL_PROVIDER = Function.prototype;

/**
 * @param {Warning} warning
 * @param {RuleDocUrlProvider} [ruleDocUrlProvider]
 * @returns {Diagnostic}
 */
module.exports = function stylelintWarningToVscodeDiagnostic(
	warning,
	ruleDocUrlProvider = NOOP_RULE_DOC_URL_PROVIDER,
) {
	if (warning === null || typeof warning !== 'object') {
		throw new TypeError(`${ARGUMENT_ERROR}, but got ${inspectWithKind(warning)}.`);
	}

	for (const prop of NUMBER_PROPERTIES) {
		const val = warning[prop];

		if (typeof val !== 'number') {
			throw new TypeError(
				`\`${prop}\` property of a stylelint warning must be a number, but it was ${inspectWithKind(
					val,
				)}.`,
			);
		}
	}

	if (typeof warning.text !== 'string') {
		throw new TypeError(
			`\`text\` property of a stylelint warning must be a string, but it was ${inspectWithKind(
				warning.text,
			)}.`,
		);
	}

	if (typeof warning.severity !== 'string') {
		throw new TypeError(
			`${SEVERITY_ERROR}, but it was a non-string value ${inspectWithKind(warning.severity)}.`,
		);
	}

	if (!VALID_SEVERITIES.has(warning.severity)) {
		throw new Error(`${SEVERITY_ERROR}, but it was ${inspectWithKind(warning.severity)}.`);
	}

	const position = Position.create(warning.line - 1, warning.column - 1);

	/**
	 * @type {URI | null | undefined}
	 */
	const ruleDocUrl = ruleDocUrlProvider(warning.rule);

	return Diagnostic.create(
		Range.create(position, position),
		warning.text,
		DiagnosticSeverity[warning.severity === 'warning' ? 'Warning' : 'Error'],
		// @ts-expect-error -- It is a types bug. DiagnosticCode exists but is not accepted in create argument.
		ruleDocUrl
			? {
					value: warning.rule,
					target: ruleDocUrl,
			  }
			: warning.rule,
		'stylelint',
	);
};
