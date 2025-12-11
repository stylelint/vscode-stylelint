import * as crypto from 'crypto';
import type { LinterResult, Warning } from 'stylelint';
import type LSP from 'vscode-languageserver-protocol';
import type { Logger } from 'winston';
import type { RuleCustomization } from '../types.js';
import { type LintDiagnostics, type RuleMetadataSource, InvalidOptionError } from './types.js';
import { warningToDiagnostic } from './warning-to-diagnostic.js';

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
	ruleMetadataSource: RuleMetadataSource | undefined,
	linterResult: LinterResult,
	logger: Logger,
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

	if (!ruleMetadata && ruleMetadataSource) {
		// Create built-in rule metadata lookup for backwards compatibility.
		ruleMetadata = new Proxy(
			{},
			{
				get: (_, key: string) => ruleMetadataSource.get(key),
			},
		);
	}

	const diagnostics: LSP.Diagnostic[] = [];
	const warningsMap = new Map<string, Warning>();

	for (const warning of warnings) {
		const diagnostic = warningToDiagnostic(warning, logger, ruleMetadata, ruleCustomizations);

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

	let hasReport = false;

	if ('report' in linterResult && typeof linterResult.report === 'string') {
		lintDiagnostics.report = linterResult.report;
		hasReport = true;
	}

	let hasModernFixes = false;

	if ('code' in linterResult && typeof linterResult.code === 'string') {
		lintDiagnostics.code = linterResult.code;
		hasModernFixes = true;
	}

	if (!hasModernFixes && !hasReport && 'output' in linterResult) {
		// eslint-disable-next-line @typescript-eslint/no-deprecated
		const { output: legacyOutput } = linterResult as {
			/**
			 * For compatibility with Stylelint versions prior to 17.x
			 * @deprecated Use `code` property instead.
			 */
			output: unknown;
		};

		if (typeof legacyOutput === 'string' && legacyOutput.length > 0) {
			lintDiagnostics.output = legacyOutput;
		}
	}

	return lintDiagnostics;
}
