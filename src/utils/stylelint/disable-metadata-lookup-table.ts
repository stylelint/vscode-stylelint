import { intersect } from '../sets';
import { getDisableDiagnosticRule } from './get-disable-diagnostic-rule';
import type LSP from 'vscode-languageserver-protocol';
import type { DisableReportRuleNames } from './types';

/**
 * Helps lookup disable reports by type, rule, or range.
 */
export class DisableMetadataLookupTable {
	/**
	 * Reports by type.
	 */
	#reportsByType = new Map<string, Set<LSP.Diagnostic>>();

	/**
	 * Reports by type.
	 */
	#reportsByRule = new Map<string, Set<LSP.Diagnostic>>();

	/**
	 * Reports by type.
	 */
	#reportsByRange = new Map<string, Set<LSP.Diagnostic>>();

	/**
	 * @param diagnostics The diagnostics to build the lookup table from.
	 */
	constructor(diagnostics: LSP.Diagnostic[]) {
		for (const diagnostic of diagnostics) {
			const rule = getDisableDiagnosticRule(diagnostic);

			if (!rule) {
				continue;
			}

			// If getDisableDiagnosticRule returns a rule, the diagnostic code
			// must be a string.
			const code = diagnostic.code as string;

			const existingByType = this.#reportsByType.get(code);

			if (existingByType) {
				existingByType.add(diagnostic);
			} else {
				this.#reportsByType.set(code, new Set([diagnostic]));
			}

			const existingByRule = this.#reportsByRule.get(rule);

			if (existingByRule) {
				existingByRule.add(diagnostic);
			} else {
				this.#reportsByRule.set(rule, new Set([diagnostic]));
			}

			const rangeKey = this.#getRangeKey(diagnostic.range);

			const existingByRange = this.#reportsByRange.get(rangeKey);

			if (existingByRange) {
				existingByRange.add(diagnostic);
			} else {
				this.#reportsByRange.set(rangeKey, new Set([diagnostic]));
			}
		}
	}

	#getRangeKey({ start, end }: LSP.Range): string {
		return `${start.line}:${start.character}:${end.line}:${end.character}`;
	}

	/**
	 * Finds the reports that match the given type, rule, and range.
	 */
	find({
		type,
		rule,
		range,
	}: {
		type?: DisableReportRuleNames | string;
		rule?: string;
		range?: LSP.Range;
	}): Set<LSP.Diagnostic> {
		const reportsByType = type ? this.#reportsByType.get(type) : undefined;
		const reportsByRule = rule ? this.#reportsByRule.get(rule) : undefined;
		const reportsByRange = range ? this.#reportsByRange.get(this.#getRangeKey(range)) : undefined;

		return intersect(intersect(reportsByType, reportsByRule), reportsByRange) ?? new Set();
	}
}
