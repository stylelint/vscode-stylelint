import type { LintDiagnostics } from '../../src/server/stylelint/types.js';

/**
 * Returns the subset of a Stylelint lint result that is safe to snapshot across
 * different Stylelint versions.
 */
export function snapshotLintDiagnostics(
	result: LintDiagnostics,
): Pick<LintDiagnostics, 'diagnostics' | 'getWarning'> {
	return {
		diagnostics: result.diagnostics,
		getWarning: result.getWarning,
	};
}
