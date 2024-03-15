// eslint-disable-next-line n/no-missing-import
import type { RemoteConsole } from 'vscode-languageserver/node';

type RemoteConsoleLogLevels = 'info' | 'debug' | 'error' | 'warn' | 'log';

type RemoteConsoleLogFunctions = RemoteConsole[RemoteConsoleLogLevels];

/**
 * Gets the log function for the given log level for the given remote console.
 */
export const getLogFunction = (
	remoteConsole: RemoteConsole,
	level: string,
	// eslint-disable-next-line @typescript-eslint/ban-types
): RemoteConsoleLogFunctions | undefined => {
	const logFunction = remoteConsole[level as RemoteConsoleLogLevels];

	if (typeof logFunction === 'function') {
		return logFunction;
	}

	return undefined;
};
