'use strict';

const TransportStream = require('winston-transport');
const { LEVEL, MESSAGE } = require('triple-beam');

const { getLogFunction } = require('./get-log-function');

/**
 * Winston transport for logging through the language server connection.
 */
class LanguageServerTransport extends TransportStream {
	/**
	 * The language server remote console.
	 * @type {lsp.RemoteConsole}
	 */
	#console;

	/**
	 * @param {LanguageServerTransportOptions} options
	 */
	constructor(options) {
		super(options);

		this.#console = options.connection.console;
	}

	/**
	 * @param {winston.Logform.TransformableInfo & {[key: string | symbol]: any}} info
	 * @param {() => void} callback
	 */
	log(info, callback) {
		setImmediate(() => {
			this.emit('logged', info);
		});

		const logFunc = getLogFunction(this.#console, info[LEVEL]);

		if (typeof logFunc === 'function') {
			logFunc.call(this.#console, String(info[MESSAGE]));
		} else {
			this.#console.log(String(info[MESSAGE]));
		}

		callback();
	}
}

module.exports = {
	LanguageServerTransport,
};
