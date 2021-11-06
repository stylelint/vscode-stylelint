import { languages, default as vscode } from 'vscode';
import { URI } from 'vscode-uri';
import type LSP from 'vscode-languageserver-protocol';

/**
 * @param {tests.Range} range
 * @returns {tests.Range}
 */
function normalizeRange(range: tests.Range): tests.Range {
	/** @type {tests.Range} */
	const obj: tests.Range = {
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
function normalizeRelatedInformation(
	relatedInformation: vscode.DiagnosticRelatedInformation[],
): tests.DiagnosticRelatedInformation[] {
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
function normalizeCode(message: vscode.Diagnostic): tests.CodePart {
	return !message.code || typeof message.code === 'string' || typeof message.code === 'number'
		? { code: message.code }
		: {
				code: message.code.value,
				codeDescription: { href: URI.from(message.code.target).toString() },
		  };
}

/**
 * Converts a VS Code diagnostic to a partial LSP diagnostic.
 */
export function normalizeDiagnostic(message: vscode.Diagnostic): tests.Diagnostic {
	const { code, codeDescription } = normalizeCode(message);

	const diagnostic: tests.Diagnostic = {
		message: message.message,
		range: normalizeRange(message.range),
		severity: (message.severity + 1) as LSP.DiagnosticSeverity,
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
export function getStylelintDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
	return languages.getDiagnostics(uri).filter((d) => d.source === 'Stylelint');
}
