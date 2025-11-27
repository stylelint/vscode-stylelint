import * as crypto from 'crypto';
import { warningToDiagnostic } from './warning-to-diagnostic';
import type { LinterResult, Warning } from 'stylelint';
import { type LintDiagnostics, type Stylelint, InvalidOptionError } from './types';
import type LSP from 'vscode-languageserver-protocol';
import type { RuleCustomization } from '../../server/types';

/**
 * Returns a unique key for a diagnostic.
 * @param diagnostic The diagnostic to get a key for.
 */
function getDiagnosticKey(diagnostic: LSP.Diagnostic): string {
	const range = diagnostic.range;
	let message = '';

	if (diagnostic.message) {
		const hash = crypto.createHash('sha256');

		hash.update(diagnostic.message);
		message = hash.digest('base64');
	}

	return `[${range.start.line},${range.start.character},${range.end.line},${range.end.character}]-${diagnostic.code}-${message}`;
}

/**
 * Processes the results of a Stylelint lint run.
 *
 * If Stylelint reported any warnings, they are converted to Diagnostics and
 * returned. If the lint results contain raw output in the `code` property, it
 * is also returned, along with any formatted report (`report`) or any legacy
 * autofixed code (`output`).
 *
 * Throws an `InvalidOptionError` for any invalid option warnings reported by
 * Stylelint.
 * @param stylelint The Stylelint instance that was used.
 * @param result The results returned by Stylelint.
 * @param ruleCustomizations Optional rule customizations for severity overrides.
 */
export function processLinterResult(
	stylelint: Stylelint,
	linterResult: LinterResult,
	ruleCustomizations?: RuleCustomization[],
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

	const diagnostics: LSP.Diagnostic[] = [];
	const warningsMap = new Map<string, Warning>();

	for (const warning of warnings) {
		const diagnostic = warningToDiagnostic(warning, ruleMetadata, ruleCustomizations);

		// Only add diagnostic if it wasn't suppressed.
		if (diagnostic !== null) {
			diagnostics.push(diagnostic);
			warningsMap.set(getDiagnosticKey(diagnostic), warning);
		}
	}

	const getWarning = (diagnostic: LSP.Diagnostic): Warning | null => {
		const key = getDiagnosticKey(diagnostic);

		return warningsMap.get(key) ?? null;
	};
	const lintDiagnostics: LintDiagnostics = { diagnostics, getWarning };

	if ('report' in linterResult && typeof linterResult.report === 'string') {
		lintDiagnostics.report = linterResult.report;
	}

	if ('code' in linterResult && typeof linterResult.code === 'string') {
		lintDiagnostics.code = linterResult.code;
	}

	if (typeof linterResult.output === 'string') {
		lintDiagnostics.output = linterResult.output;
	}

	return lintDiagnostics;
}
