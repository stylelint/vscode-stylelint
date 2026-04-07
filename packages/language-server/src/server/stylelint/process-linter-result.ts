import type LSP from 'vscode-languageserver-protocol';
import type { Logger } from 'winston';
import type { RuleCustomization } from '../types.js';
import {
	InvalidOptionError,
	type LintDiagnostics,
	type LintResult,
	type LinterResult,
	type MultiFileLintDiagnostics,
	type RuleMetadataSource,
	type Warning,
} from './types.js';
import { warningToDiagnostic } from './warning-to-diagnostic.js';

/**
 * Returns a unique key for a diagnostic.
 * @param diagnostic The diagnostic to get a key for.
 */
function getDiagnosticKey({ range: { start, end }, code, message }: LSP.Diagnostic): string {
	return `[${start.line},${start.character},${end.line},${end.character}]-${code}-${message}`;
}

/**
 * Resolves the rule metadata record from a linter result, falling back to
 * the built-in rule metadata source when necessary.
 */
function resolveRuleMetadata(
	linterResult: LinterResult,
	ruleMetadataSource: RuleMetadataSource | undefined,
): LinterResult['ruleMetadata'] {
	if (linterResult.ruleMetadata) {
		return linterResult.ruleMetadata;
	}

	if (ruleMetadataSource) {
		// Create built-in rule metadata lookup for backwards compatibility.
		return new Proxy(
			{},
			{
				get: (_, key: string) => ruleMetadataSource.get(key),
			},
		);
	}

	return undefined;
}

/**
 * Converts a single Stylelint lint result into diagnostics.
 */
function processSingleLintResult(
	result: LintResult,
	logger: Logger,
	ruleMetadata: LinterResult['ruleMetadata'],
	ruleCustomizations?: RuleCustomization[],
): LintDiagnostics {
	if (result.ignored) {
		return { diagnostics: [] };
	}

	if (result.invalidOptionWarnings.length !== 0) {
		throw new InvalidOptionError(result.invalidOptionWarnings);
	}

	const diagnostics: LSP.Diagnostic[] = [];
	const warningsMap = new Map<string, Warning>();

	for (const warning of result.warnings) {
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

	return { diagnostics, getWarning };
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
 * @param ruleMetadataSource Rule metadata source for documentation links.
 * @param linterResult The results returned by Stylelint.
 * @param logger The logger to use.
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

	const firstResult = results[0];

	if (firstResult.ignored) {
		return { diagnostics: [] };
	}

	const ruleMetadata = resolveRuleMetadata(linterResult, ruleMetadataSource);
	const lintDiagnostics = processSingleLintResult(
		firstResult,
		logger,
		ruleMetadata,
		ruleCustomizations,
	);

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

/**
 * Processes the results of a multi-file Stylelint lint run.
 *
 * Each result is expected to have a `source` property containing the absolute
 * file path of the linted file. Results without a source are skipped. The
 * returned map is keyed by file path.
 *
 * @param ruleMetadataSource Rule metadata source for documentation links.
 * @param linterResult The results returned by Stylelint.
 * @param logger The logger to use.
 * @param ruleCustomizations Optional rule customizations for severity overrides.
 */
export function processMultiFileLinterResult(
	ruleMetadataSource: RuleMetadataSource | undefined,
	linterResult: LinterResult,
	logger: Logger,
	ruleCustomizations?: RuleCustomization[],
): MultiFileLintDiagnostics {
	const { results } = linterResult;
	const multiFileResult: MultiFileLintDiagnostics = new Map();
	const ruleMetadata = resolveRuleMetadata(linterResult, ruleMetadataSource);

	for (const result of results) {
		if (!result.source || result.ignored) {
			continue;
		}

		multiFileResult.set(
			result.source,
			processSingleLintResult(result, logger, ruleMetadata, ruleCustomizations),
		);
	}

	return multiFileResult;
}
