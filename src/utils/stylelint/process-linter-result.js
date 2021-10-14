'use strict';

const { warningToDiagnostic } = require('./warning-to-diagnostic');
const { InvalidOptionError } = require('../types');

/**
 * Processes the results of a Stylelint lint run.
 *
 * If Stylelint reported any warnings, they are converted to Diagnostics and
 * returned. If the lint results contain raw output in the `output` property, it
 * is also returned.
 *
 * Throws an `InvalidOptionError` for any invalid option warnings reported by
 * Stylelint.
 * @param {stylelint.PublicApi} stylelint The Stylelint instance that was used.
 * @param {stylelint.LinterResult} result The results returned by Stylelint.
 * @returns {StylelintVSCodeResult}
 */
function processLinterResult(stylelint, { results, output }) {
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

	const diagnostics = warnings.map((warning) => warningToDiagnostic(warning, stylelint.rules));

	return output ? { output, diagnostics } : { diagnostics };
}

module.exports = {
	processLinterResult,
};
