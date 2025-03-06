import type { RemoteConsole } from 'vscode-languageserver/node';

type RemoteConsoleLogLevels = 'info' | 'debug' | 'error' | 'warn' | 'log';

type RemoteConsoleLogFunctions = RemoteConsole[RemoteConsoleLogLevels];

/**
 * Gets the log function for the given log level for the given remote console.
 */
export const getLogFunction = (
	remoteConsole: RemoteConsole,
	level: string,
): RemoteConsoleLogFunctions | undefined => {
	const logFunction = remoteConsole[level as RemoteConsoleLogLevels];

	if (typeof logFunction === 'function') {
		return logFunction;
	}

	return undefined;
};
