import { EventEmitter } from 'node:events';

import type { PublicApi } from '../types.js';

/**
 * Creates the extension public API surface.
 */
export function createPublicApi(): PublicApi {
	return Object.assign(new EventEmitter(), { codeActionReady: false }) as PublicApi;
}
