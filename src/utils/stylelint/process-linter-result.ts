import { warningToDiagnostic } from './warning-to-diagnostic';
// eslint-disable-next-line n/no-unpublished-import
import type { LinterResult } from 'stylelint';
import { type LintDiagnostics, type Stylelint, InvalidOptionError } from './types';

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
	stylelint: Stylelint,
	linterResult: LinterResult,
): LintDiagnostics {
	const { results } = linterResult;

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

	let { ruleMetadata } = linterResult;

	if (!ruleMetadata) {
		// Create built-in rule metadata for backwards compatibility.
		ruleMetadata = new Proxy(
			{},
			{
				get: (_, key: string) => {
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore -- (TS7053) `stylelint.rules` has returned `Promise` values since v16.
					// See https://stylelint.io/migration-guide/to-16#changed-nodejs-api-stylelintrules-object
					//
					// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
					return stylelint.rules?.[key]?.meta;
				},
			},
		);
	}

	const diagnostics = warnings.map((warning) => warningToDiagnostic(warning, ruleMetadata));
	const output = ('report' in linterResult && linterResult.report) || linterResult.output;

	return output ? { output, diagnostics } : { diagnostics };
}
