'use strict';

const { LEVEL, MESSAGE } = require('triple-beam');

const { getLogFunction } = require('./get-log-function');
const { padString, padNumber, upperCaseFirstChar } = require('../strings');

/**
 * Language server formatter for winston.
 * @type {LanguageServerFormatterConstructor}
 */
class LanguageServerFormatter {
	/**
	 * @param {LanguageServerFormatterOptions} options
	 */
	constructor(options) {
		this.options = options;
	}

	/**
	 * @param {winston.Logform.TransformableInfo & {[key: string | symbol]: any}} info
	 * @returns {winston.Logform.TransformableInfo}
	 */
	transform(info) {
		const date = new Date();

		// h:mm:ss a.m./p.m.
		const timestamp = `${date.getHours() % 12 || 12}:${padNumber(date.getMinutes(), 2)}:${padNumber(
			date.getSeconds(),
			2,
		)} ${date.getHours() < 12 ? 'a.m.' : 'p.m.'}`;

		const messageParts = [];

		if (!getLogFunction(this.options.connection.console, info[LEVEL])) {
			messageParts.push(`[${padString(upperCaseFirstChar(info[LEVEL]), 5)} - ${timestamp}]`);
		}

		if (info.component) {
			messageParts.push(`[${info.component}]`);
		}

		messageParts.push(info[MESSAGE]);

		let appended = false;

		/** @param {string[]} keys */
		const parseKeys = (keys) => {
			for (const key of keys) {
				if (key === 'level' || key === 'message') {
					continue;
				}

				if (Object.hasOwnProperty.call(info, key)) {
					if (!appended) {
						messageParts.push('|');
						appended = true;
					}

					messageParts.push(`${key}: ${JSON.stringify(info[key])}`);

					delete info[key];
				}
			}
		};

		if (this.options.preferredKeyOrder) {
			parseKeys(this.options.preferredKeyOrder);
		}

		delete info.component;
		delete info.timestamp;

		parseKeys(Object.keys(info));

		const message = messageParts.join(' ');

		info[MESSAGE] = message;
		info.message = message;

		return info;
	}
}

module.exports = {
	LanguageServerFormatter,
};
