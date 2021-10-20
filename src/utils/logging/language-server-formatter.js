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

		messageParts.push(info.message);

		delete info.component;
		delete info.timestamp;

		const keys = new Set(Object.keys({ ...info }));
		const postMessageParts = [];

		if (this.options.preferredKeyOrder) {
			for (const key of this.options.preferredKeyOrder) {
				if (keys.has(key)) {
					postMessageParts.push(`${key}: ${JSON.stringify(info[key])}`);

					keys.delete(key);
					delete info[key];
				}
			}
		}

		for (const key of keys) {
			if (key === 'level' || key === 'message') {
				continue;
			}

			postMessageParts.push(`${key}: ${JSON.stringify(info[key])}`);

			delete info[key];
		}

		const message =
			postMessageParts.length > 0
				? `${messageParts.join(' ')} | ${postMessageParts.join(' ')}`
				: messageParts.join(' ');

		info[MESSAGE] = message;
		info.message = message;

		return info;
	}
}

module.exports = {
	LanguageServerFormatter,
};
