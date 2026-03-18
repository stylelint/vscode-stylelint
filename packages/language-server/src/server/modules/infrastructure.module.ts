// @no-unit-test -- Module definition file that does not need unit tests.

import { module } from '../../di/index.js';
import { CommandService, NotificationService } from '../services/infrastructure/index.js';

export const infrastructureModule = module({
	register: [CommandService, NotificationService],
});
