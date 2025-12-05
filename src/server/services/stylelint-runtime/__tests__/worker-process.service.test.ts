import { describe, expect, test } from 'vitest';

import { createLoggingServiceStub, createTestLogger } from '../../../../../test/helpers/index.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { StylelintWorkerProcess } from '../../../worker/worker-process.js';
import { loggingServiceToken } from '../../infrastructure/logging.service.js';
import { WorkerProcessService } from '../../stylelint-runtime/worker-process.service.js';

describe('WorkerProcessService', () => {
	test('creates Stylelint worker processes with contextual logging', () => {
		const rootLogger = createTestLogger();
		const childLogger = createTestLogger();

		rootLogger.child.mockReturnValue(childLogger);

		const loggingService = createLoggingServiceStub(rootLogger);
		const container = createContainer(
			module({
				register: [
					provideTestValue(loggingServiceToken, () => loggingService),
					WorkerProcessService,
				],
			}),
		);
		const service = container.resolve(WorkerProcessService);
		const worker = service.createWorkerProcess('/workspace', 1000, {
			registerPath: '/pnp/register.js',
		});

		expect(worker).toBeInstanceOf(StylelintWorkerProcess);
		expect(loggingService.createLogger).toHaveBeenCalledWith(WorkerProcessService);
		expect(rootLogger.debug).toHaveBeenCalledWith('Creating Stylelint worker process', {
			workerRoot: '/workspace',
		});
		expect(rootLogger.child).toHaveBeenCalledWith({ workerRoot: '/workspace' });
	});
});
