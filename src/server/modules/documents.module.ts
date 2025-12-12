// @no-unit-test -- Module definition file that does not need unit tests.

import { module, provideValue } from '../../di/index.js';
import {
	DocumentDiagnosticsService,
	DocumentFixesService,
	getFixesFnToken,
} from '../services/index.js';
import { getFixes } from '../utils/index.js';

export const documentsModule = module({
	register: [
		provideValue(getFixesFnToken, () => getFixes),
		DocumentDiagnosticsService,
		DocumentFixesService,
	],
});
