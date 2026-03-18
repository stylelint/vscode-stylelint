import winston from 'winston';
import { inject } from '../../../di/index.js';
import { PnPConfiguration } from '../../types.js';
import { defaultWorkerIdleTimeoutMs, StylelintWorkerProcess } from '../../worker/worker-process.js';
import { LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';

@inject({
	inject: [loggingServiceToken],
})
export class WorkerProcessService {
	#logger: winston.Logger;

	constructor(loggingService: LoggingService) {
		this.#logger = loggingService.createLogger(WorkerProcessService);
	}

	createWorkerProcess(
		workerRoot: string,
		idleTimeoutMs = defaultWorkerIdleTimeoutMs,
		pnpConfig?: PnPConfiguration,
	): StylelintWorkerProcess {
		this.#logger.debug('Creating Stylelint worker process', { workerRoot });

		return new StylelintWorkerProcess(
			workerRoot,
			this.#logger.child({ workerRoot }),
			idleTimeoutMs,
			pnpConfig,
		);
	}
}
