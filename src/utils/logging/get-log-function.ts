// eslint-disable-next-line n/no-missing-import
import type { RemoteConsole } from 'vscode-languageserver/node';
import type { ExtractKeysOfValueType } from '../types';

/**
 * Gets the log function for the given log level for the given remote console.
 */
export const getLogFunction = (
	remoteConsole: RemoteConsole,
	level: string,
	// eslint-disable-next-line @typescript-eslint/ban-types
): RemoteConsole[ExtractKeysOfValueType<RemoteConsole, Function>] | undefined => {
	const logFunction = remoteConsole[level as keyof RemoteConsole];

	if (typeof logFunction === 'function') {
		return logFunction;
	}

	return undefined;
};
