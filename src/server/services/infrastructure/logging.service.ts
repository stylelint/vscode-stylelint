// @no-unit-test -- Service is only an interface and token definition.

import type winston from 'winston';
import { type Constructable, createToken } from '../../../di/index.js';

export const loggingServiceToken = createToken<LoggingService>('LoggingService');

export interface LoggingService {
	createLogger(component: Constructable<unknown>): winston.Logger;
}
