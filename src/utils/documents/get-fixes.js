'use strict';

const { createTextEdits } = require('./create-text-edits');

/**
 * Runs Stylelint and returns fix text edits for the given document.
 * @param {StylelintRunner} runner The Stylelint runner.
 * @param {lsp.TextDocument} document The document to get fixes for.
 * @param {stylelint.LinterOptions} [linterOptions] Linter options to use.
 * @param {ExtensionOptions} [extensionOptions] The extension options.
 * @returns {Promise<lsp.TextEdit[]>}
 */
async function getFixes(runner, document, linterOptions = {}, extensionOptions = {}) {
	const result = await runner.lintDocument(
		document,
		{ ...linterOptions, fix: true },
		extensionOptions,
	);

	return typeof result.output === 'string' ? createTextEdits(document, result.output) : [];
}

module.exports = {
	getFixes,
};
