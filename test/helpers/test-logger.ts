import { vi, Mocked } from 'vitest';
import type winston from 'winston';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type TestLogger = Mocked<winston.Logger> & {
	setDebugEnabled: (value: boolean) => void;
};

/**
 * Creates a test logger that records log entries in memory.
 */
export function createTestLogger(): TestLogger {
	let debugEnabled = true;

	const logger = {
		level: 'debug',
		child: vi.fn(() => logger),
		log: vi.fn(() => logger),
		debug: vi.fn(() => logger),
		info: vi.fn(() => logger),
		warn: vi.fn(() => logger),
		error: vi.fn(() => logger),
		isDebugEnabled: () => debugEnabled,
		setDebugEnabled: (value: boolean) => {
			debugEnabled = value;
		},
	} as unknown as TestLogger;

	return logger;
}
