import { vi, type Mock } from 'vitest';

import type { LoggingService } from '../../../src/server/services/index.js';
import { createTestLogger, TestLogger } from '../test-logger.js';

export type LoggingServiceStub = LoggingService & {
	createLogger: Mock<LoggingService['createLogger']>;
};

export function createLoggingServiceStub(logger?: TestLogger): LoggingServiceStub {
	return {
		createLogger: logger
			? (vi.fn(() => logger) as LoggingServiceStub['createLogger'])
			: vi.fn(() => createTestLogger()),
	};
}
