'use strict';

const inspectWithKind = require('inspect-with-kind');
const {Diagnostic, DiagnosticSeverity, Position, Range} = require('vscode-languageserver-types');

const NUMBER_PROPERTIES = new Set(['line', 'column']);
const VALID_SEVERITIES = new Set(['error', 'warning']);

const ARGUMENT_ERROR = 'Expected a stylelint warning ({line: <number>, colum: <number>, rule: <string>, severity: <string>, text: <string>})';
const SEVERITY_ERROR = '`severity` property of a stylelint warning must be either \'error\' or \'warning\'';

module.exports = function stylelintWarningToVscodeDiagnostic(warning) {
	if (warning === null || typeof warning !== 'object') {
		throw new TypeError(`${ARGUMENT_ERROR}, but got ${inspectWithKind(warning)}.`);
	}

	for (const prop of NUMBER_PROPERTIES) {
		const val = warning[prop];

		if (typeof val !== 'number') {
			throw new TypeError(`\`${prop}\` property of a stylelint warning must be a number, but it was ${
				inspectWithKind(val)
			}.`);
		}
	}

	if (typeof warning.text !== 'string') {
		throw new TypeError(`\`text\` property of a stylelint warning must be a string, but it was ${
			inspectWithKind(warning.text)
		}.`);
	}

	if (typeof warning.severity !== 'string') {
		throw new TypeError(`${SEVERITY_ERROR}, but it was a non-string value ${
			inspectWithKind(warning.severity)
		}.`);
	}

	if (!VALID_SEVERITIES.has(warning.severity)) {
		throw new Error(`${SEVERITY_ERROR}, but it was ${
			inspectWithKind(warning.severity)
		}.`);
	}

	const position = Position.create(warning.line - 1, warning.column - 1);

	return Diagnostic.create(
		Range.create(position, position),
		warning.text,
		DiagnosticSeverity[warning.severity === 'warning' ? 'Warning' : 'Error'],
		warning.rule,
		'stylelint'
	);
};
