'use strict';

const { languages } = require('vscode');
const { URI } = require('vscode-uri');

/**
 * @typedef {import('vscode').Uri} Uri
 * @typedef {import('vscode').Range} Range
 * @typedef {import('vscode').Position} Position
 * @typedef {import('vscode').Diagnostic} VSCodeDiagnostic
 * @typedef {import('vscode').DiagnosticRelatedInformation} VSCodeDiagnosticRelatedInformation
 * @typedef {import('vscode-languageserver').Diagnostic} LSPDiagnostic
 * @typedef {import('vscode-languageserver').DiagnosticSeverity} DiagnosticSeverity
 * @typedef {import('vscode-languageserver').CodeDescription} CodeDescription
 * @typedef {import('vscode-languageserver').DiagnosticRelatedInformation} LSPDiagnosticRelatedInformation
 * @typedef {{code?: string | number, codeDescription?: CodeDescription}} CodePart
 */

/**
 * @template {Record<any, any>} T
 * @template {keyof T} K
 * @typedef {Partial<T> & Pick<T, K>} OptionalExcept
 */

/**
 * @typedef {OptionalExcept<Position, 'line' | 'character'>} PartialPosition
 * @typedef {{ start: PartialPosition, end?: PartialPosition }} PartialRange
 * @typedef {{ location: { range: PartialRange, uri: string }, message: string }} PartialRelatedInformation
 * @typedef {Omit<LSPDiagnostic, 'range' | 'relatedInformation'> &
 *   { range: PartialRange, relatedInformation?: PartialRelatedInformation[] }
 * } PartialLSPDiagnostic
 */

/**
 * Converts a VS Code diagnostic to a partial LSP diagnostic.
 * @template {Record<any, any>} T
 * @param {VSCodeDiagnostic} message
 * @returns {PartialLSPDiagnostic}
 */
function normalizeDiagnostic(message) {
	const { code, codeDescription } = normalizeCode(message);

	/** @type {PartialLSPDiagnostic} */
	const diagnostic = {
		message: message.message,
		range: normalizeRange(message.range),
		severity: /** @type {DiagnosticSeverity} */ (message.severity + 1),
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
 * @param {Uri} uri
 * @returns {VSCodeDiagnostic[]}
 */
function getStylelintDiagnostics(uri) {
	return languages.getDiagnostics(uri).filter((d) => d.source === 'stylelint');
}

/**
 * @param {PartialRange} range
 * @returns {PartialRange}
 */
function normalizeRange(range) {
	/** @type {PartialRange} */
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
 * @param {VSCodeDiagnosticRelatedInformation[]} relatedInformation
 * @returns {PartialRelatedInformation[]}
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
 * @param {VSCodeDiagnostic} message
 * @returns {CodePart}
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
