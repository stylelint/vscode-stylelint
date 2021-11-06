import { serializeErrors } from '../errors';
import type winston from 'winston';

/**
 * Language server formatter for winston.
 */
export class ErrorFormatter {
	transform(info: winston.Logform.TransformableInfo): winston.Logform.TransformableInfo {
		const transformed = serializeErrors({ ...info });

		for (const key of Object.keys(transformed)) {
			info[key] = transformed[key];
		}

		return info;
	}
}
