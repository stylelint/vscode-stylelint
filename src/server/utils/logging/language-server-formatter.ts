import { LEVEL, MESSAGE } from 'triple-beam';
import type winston from 'winston';
import type { Connection } from 'vscode-languageserver';

import { getLogFunction } from './get-log-function.js';
import { padString, padNumber, upperCaseFirstChar } from '../strings.js';

/**
 * Language server log formatter options.
 */
export type LanguageServerFormatterOptions = {
	connection: Connection;
	preferredKeyOrder?: string[];
};

/**
 * Language server formatter for winston.
 */
export class LanguageServerFormatter {
	options: LanguageServerFormatterOptions;

	constructor(options: LanguageServerFormatterOptions) {
		this.options = options;
	}

	transform(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		info: winston.Logform.TransformableInfo & { [key: string | symbol]: any },
	): winston.Logform.TransformableInfo {
		const date = new Date();

		// h:mm:ss a.m./p.m.
		const timestamp = `${date.getHours() % 12 || 12}:${padNumber(date.getMinutes(), 2)}:${padNumber(
			date.getSeconds(),
			2,
		)} ${date.getHours() < 12 ? 'a.m.' : 'p.m.'}`;

		const messageParts = [];
		const level = String(info[LEVEL]);

		if (!getLogFunction(this.options.connection.console, level)) {
			messageParts.push(`[${padString(upperCaseFirstChar(level), 5)} - ${timestamp}]`);
		}

		if (info.component) {
			messageParts.push(`[${String(info.component)}]`);
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
