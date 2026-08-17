import type LSP from 'vscode-languageserver-protocol';
import { DisableReportRuleNames } from './types.js';

/**
 * Gets the rule name to which a disable diagnostic applies. Returns `undefined`
 * if the diagnostic is not a disable diagnostic.
 * @param diagnostic The diagnostic corresponding to the Stylelint warning.
 */
export function getDisableDiagnosticRule(diagnostic: LSP.Diagnostic): string | undefined {
	// Stylelint's disable-report messages are always plain strings; `Diagnostic.message`
	// widened to `string | MarkupContent` in LSP 3.18, so normalise before matching.
	const message =
		typeof diagnostic.message === 'string' ? diagnostic.message : diagnostic.message.value;

	// eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
	switch (diagnostic.code) {
		case DisableReportRuleNames.Needless:
			return message.match(/^Needless disable for "(.+)"$/)?.[1];

		case DisableReportRuleNames.InvalidScope:
			return message.match(/^Rule "(.+)" isn't enabled$/)?.[1];

		case DisableReportRuleNames.Descriptionless:
			return message.match(/^Disable for "(.+)" is missing a description$/)?.[1];

		case DisableReportRuleNames.Illegal:
			return message.match(/^Rule "(.+)" may not be disabled$/)?.[1];

		default:
			return undefined;
	}
}
