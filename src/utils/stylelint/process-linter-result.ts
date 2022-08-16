import { warningToDiagnostic } from './warning-to-diagnostic';
// eslint-disable-next-line node/no-unpublished-import
import type stylelint from 'stylelint';
import { LintDiagnostics, InvalidOptionError } from './types';

/**
 * Processes the results of a Stylelint lint run.
 *
 * If Stylelint reported any warnings, they are converted to Diagnostics and
 * returned. If the lint results contain raw output in the `output` property, it
 * is also returned.
 *
 * Throws an `InvalidOptionError` for any invalid option warnings reported by
 * Stylelint.
 * @param stylelint The Stylelint instance that was used.
 * @param result The results returned by Stylelint.
 */
export function processLinterResult(
	stylelint: stylelint.PublicApi,
	{ results, output, ruleMetadata }: stylelint.LinterResult,
): LintDiagnostics {
	if (results.length === 0) {
		return { diagnostics: [] };
	}

	const [{ invalidOptionWarnings, warnings, ignored }] = results;

	if (ignored) {
		return { diagnostics: [] };
	}

	if (invalidOptionWarnings.length !== 0) {
		throw new InvalidOptionError(invalidOptionWarnings);
	}

	if(!ruleMetadata) {
		// Create built-in rule metadata for backwards compatibility.
		ruleMetadata = new Proxy({}, {
			get: (_, key:string) => {
				return stylelint.rules?.[key]?.meta;
			}
		})
	}

	const diagnostics = warnings.map((warning) => warningToDiagnostic(warning, ruleMetadata));

	return output ? { output: output as string, diagnostics } : { diagnostics };
}
