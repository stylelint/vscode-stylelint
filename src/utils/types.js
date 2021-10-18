'use strict';

const { CodeActionKind: VSCodeActionKind } = require('vscode-languageserver-types');

/**
 * Command IDs
 * @enum {string}
 */
const CommandId = {
	ApplyAutoFix: 'stylelint.applyAutoFix',
};

/**
 * Code action kinds
 * @enum {string}
 */
const CodeActionKind = {
	StylelintSourceFixAll: `${VSCodeActionKind.SourceFixAll}.stylelint`,
};

/**
 * Error thrown when a rule's option is invalid.
 */
class InvalidOptionError extends Error {
	/** @param {{text: string}[]} warnings */
	constructor(warnings) {
		const reasons = warnings.map((warning) => warning.text);

		super(reasons.join('\n'));
		this.reasons = reasons;
	}
}

module.exports = {
	CommandId,
	CodeActionKind,
	InvalidOptionError,
};
