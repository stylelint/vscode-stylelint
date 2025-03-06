import type LSP from 'vscode-languageserver-protocol';
import { DisableReportRuleNames } from './types';

/**
 * Gets the rule name to which a disable diagnostic applies. Returns `undefined`
 * if the diagnostic is not a disable diagnostic.
 * @param diagnostic The diagnostic corresponding to the Stylelint warning.
 */
export function getDisableDiagnosticRule(diagnostic: LSP.Diagnostic): string | undefined {
	// eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
	switch (diagnostic.code) {
		case DisableReportRuleNames.Needless:
			return diagnostic.message.match(/^Needless disable for "(.+)"$/)?.[1];

		case DisableReportRuleNames.InvalidScope:
			return diagnostic.message.match(/^Rule "(.+)" isn't enabled$/)?.[1];

		case DisableReportRuleNames.Descriptionless:
			return diagnostic.message.match(/^Disable for "(.+)" is missing a description$/)?.[1];

		case DisableReportRuleNames.Illegal:
			return diagnostic.message.match(/^Rule "(.+)" may not be disabled$/)?.[1];

		default:
			return undefined;
	}
}
