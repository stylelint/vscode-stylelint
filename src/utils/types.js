'use strict';

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
	InvalidOptionError,
};
