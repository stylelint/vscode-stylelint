'use strict';

/**
 * @typedef {{
 *   indentation: [number | string],
 *   'no-missing-end-of-source-newline'?: boolean,
 *   'no-eol-whitespace'?: boolean,
 * }} FormattingRules
 */

/**
 * Converts the given formatting options to rules.
 * @param {lsp.FormattingOptions} options The formatting options.
 * @returns {FormattingRules} The rules.
 */
function formattingOptionsToRules({
	insertSpaces,
	tabSize,
	insertFinalNewline,
	trimTrailingWhitespace,
}) {
	// NOTE: There is no equivalent rule for trimFinalNewlines, so it is not respected.

	/** @type {FormattingRules} */
	const rules = {
		indentation: [insertSpaces ? tabSize : 'tab'],
	};

	if (insertFinalNewline !== undefined) {
		rules['no-missing-end-of-source-newline'] = insertFinalNewline;
	}

	if (trimTrailingWhitespace !== undefined) {
		rules['no-eol-whitespace'] = trimTrailingWhitespace;
	}

	return rules;
}

module.exports = {
	formattingOptionsToRules,
};
