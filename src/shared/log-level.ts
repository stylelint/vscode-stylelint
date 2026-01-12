// @no-unit-test -- Type definition and simple type checking only.

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Parses a log level from an unknown value.
 */
export function parseLogLevel(value: unknown): LogLevel | undefined {
	if (value === 'error' || value === 'warn' || value === 'info' || value === 'debug') {
		return value;
	}

	return undefined;
}
