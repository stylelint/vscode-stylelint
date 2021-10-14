'use strict';

const os = require('os');
const { URI } = require('vscode-uri');
const { StylelintResolver } = require('../packages/stylelint-resolver');
const { processLinterResult } = require('./process-linter-result');

/**
 * Runs Stylelint in VS Code.
 */
class StylelintRunner {
	/**
	 * @param {lsp.Connection} [connection]
	 */
	constructor(connection) {
		/** @private */
		this._stylelintResolver = new StylelintResolver(connection);
	}

	/**
	 * Lints the given document using Stylelint. The linting result is then
	 * converted to LSP diagnostics and returned.
	 * @param {lsp.TextDocument} textDocument
	 * @param {stylelint.LinterOptions} linterOptions
	 * @param {StylelintVSCodeOptions} serverOptions
	 * @returns {Promise<StylelintVSCodeResult>}
	 */
	async lintDocument(textDocument, linterOptions = {}, serverOptions = {}) {
		const stylelint = await this._stylelintResolver.resolve(serverOptions, textDocument);

		if (!stylelint) {
			return { diagnostics: [] };
		}

		const { fsPath } = URI.parse(textDocument.uri);

		// Workaround for Stylelint treating paths as case-sensitive on Windows
		// If the drive letter is lowercase, we need to convert it to uppercase
		// See https://github.com/stylelint/stylelint/issues/5594
		// TODO: Remove once fixed upstream
		const codeFilename =
			os.platform() === 'win32'
				? fsPath.replace(/^[a-z]:/, (match) => match.toUpperCase())
				: fsPath;

		/** @type {stylelint.LinterOptions} */
		const options = {
			...linterOptions,
			code: textDocument.getText(),
			formatter: () => '',
		};

		if (codeFilename) {
			options.codeFilename = codeFilename;
		} else if (!linterOptions?.config?.rules) {
			options.config = { rules: {} };
		}

		try {
			return processLinterResult(stylelint, await stylelint.lint(options));
		} catch (err) {
			if (
				err instanceof Error &&
				(err.message.startsWith('No configuration provided for') ||
					err.message.includes('No rules found within configuration'))
			) {
				// Check only CSS syntax errors without applying any stylelint rules
				return processLinterResult(
					stylelint,
					await stylelint.lint({ ...options, config: { rules: {} } }),
				);
			}

			throw err;
		}
	}
}

module.exports = {
	StylelintRunner,
};
