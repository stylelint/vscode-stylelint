'use strict';

const { languages } = require('vscode');
const { URI } = require('vscode-uri');

/**
 * Converts a VS Code diagnostic to a partial LSP diagnostic.
 * @param {vscode.Diagnostic} message
 * @returns {tests.Diagnostic}
 */
function normalizeDiagnostic(message) {
	const { code, codeDescription } = normalizeCode(message);

	/** @type {tests.Diagnostic} */
	const diagnostic = {
		message: message.message,
		range: normalizeRange(message.range),
		severity: /** @type {lsp.DiagnosticSeverity} */ (message.severity + 1),
	};

	if (code !== undefined) {
		diagnostic.code = code;
	}

	if (codeDescription !== undefined) {
		diagnostic.codeDescription = codeDescription;
	}

	if (message.relatedInformation !== undefined) {
		diagnostic.relatedInformation = normalizeRelatedInformation(message.relatedInformation);
	}

	if (message.source !== undefined) {
		diagnostic.source = message.source;
	}

	if (message.tags !== undefined) {
		diagnostic.tags = message.tags;
	}

	return diagnostic;
}

/**
 * @param {vscode.Uri} uri
 * @returns {vscode.Diagnostic[]}
 */
function getStylelintDiagnostics(uri) {
	return languages.getDiagnostics(uri).filter((d) => d.source === 'Stylelint');
}

/**
 * @param {tests.Range} range
 * @returns {tests.Range}
 */
function normalizeRange(range) {
	/** @type {tests.Range} */
	const obj = {
		start: {
			line: range.start.line,
			character: range.start.character,
		},
	};

	if (range.end !== undefined) {
		obj.end = {
			line: range.end.line,
			character: range.end.character,
		};
	}

	return obj;
}

/**
 * @param {vscode.DiagnosticRelatedInformation[]} relatedInformation
 * @returns {tests.DiagnosticRelatedInformation[]}
 */
function normalizeRelatedInformation(relatedInformation) {
	return relatedInformation.map(({ location, message }) => ({
		location: {
			range: normalizeRange(location.range),
			uri: URI.from(location.uri).toString(),
		},
		message,
	}));
}

/**
 * @param {vscode.Diagnostic} message
 * @returns {tests.CodePart}
 */
function normalizeCode(message) {
	return !message.code || typeof message.code === 'string' || typeof message.code === 'number'
		? { code: message.code }
		: {
				code: message.code.value,
				codeDescription: { href: URI.from(message.code.target).toString() },
		  };
}

module.exports = {
	normalizeDiagnostic,
	getStylelintDiagnostics,
};
