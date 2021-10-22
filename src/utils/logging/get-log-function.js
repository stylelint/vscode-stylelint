'use strict';

/**
 * @param {lsp.RemoteConsole} remoteConsole
 * @param {string} level
 * @returns {lsp.RemoteConsole[ExtractKeysOfValueType<lsp.RemoteConsole, Function>] | undefined}
 */
const getLogFunction = (remoteConsole, level) => {
	const logFunction = remoteConsole[/** @type {keyof lsp.RemoteConsole} */ (level)];

	if (typeof logFunction === 'function') {
		return logFunction;
	}

	return undefined;
};

module.exports = {
	getLogFunction,
};
