'use strict';

const { serializeErrors } = require('../errors');

/**
 * Language server formatter for winston.
 * @type {ErrorFormatterConstructor}
 */
class ErrorFormatter {
	/**
	 * @param {winston.Logform.TransformableInfo & {[key: string | symbol]: any}} info
	 * @returns {winston.Logform.TransformableInfo}
	 */
	transform(info) {
		const transformed = serializeErrors({ ...info });

		for (const key of Object.keys(transformed)) {
			info[key] = transformed[key];
		}

		return info;
	}
}

module.exports = {
	ErrorFormatter,
};
