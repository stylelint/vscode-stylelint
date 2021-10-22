'use strict';

const { intersect } = require('../sets');
const { getDisableDiagnosticRule } = require('./get-disable-diagnostic-rule');

/**
 * Helps lookup disable reports by type, rule, or range.
 */
class DisableMetadataLookupTable {
	/**
	 * Reports by type.
	 * @type {Map<string, Set<lsp.Diagnostic>>}
	 */
	#reportsByType = new Map();

	/**
	 * Reports by type.
	 * @type {Map<string, Set<lsp.Diagnostic>>}
	 */
	#reportsByRule = new Map();

	/**
	 * Reports by type.
	 * @type {Map<string, Set<lsp.Diagnostic>>}
	 */
	#reportsByRange = new Map();

	/**
	 * @param {lsp.Diagnostic[]} diagnostics The diagnostics to build the lookup
	 * table from.
	 */
	constructor(diagnostics) {
		for (const diagnostic of diagnostics) {
			const rule = getDisableDiagnosticRule(diagnostic);

			if (!rule) {
				continue;
			}

			// If getDisableDiagnosticRule returns a rule, the diagnostic code
			// must be a string.
			const code = /** @type {string} */ (diagnostic.code);

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

	/**
	 * @param {lsp.Range} range
	 * @returns {string}
	 */
	#getRangeKey({ start, end }) {
		return `${start.line}:${start.character}:${end.line}:${end.character}`;
	}

	/**
	 * Finds the reports that match the given type, rule, and range.
	 * @param {{
	 *   type?: import('../types').DisableReportRuleNames | string;
	 *   rule?: string;
	 *   range?: lsp.Range;
	 * }} options
	 * @returns {Set<lsp.Diagnostic>}
	 */
	find({ type, rule, range }) {
		const reportsByType = type ? this.#reportsByType.get(type) : undefined;
		const reportsByRule = rule ? this.#reportsByRule.get(rule) : undefined;
		const reportsByRange = range ? this.#reportsByRange.get(this.#getRangeKey(range)) : undefined;

		return intersect(intersect(reportsByType, reportsByRule), reportsByRange) ?? new Set();
	}
}

module.exports = {
	DisableMetadataLookupTable,
};
