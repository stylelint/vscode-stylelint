// @no-unit-test -- No logic, just DI module definition.

import { module } from '../di/index.js';
import {
	documentsModule,
	infrastructureModule,
	lspModule,
	stylelintRuntimeModule,
	workspaceModule,
} from './modules/index.js';

export const languageServerModule = module({
	imports: [
		infrastructureModule,
		workspaceModule,
		stylelintRuntimeModule,
		documentsModule,
		lspModule,
	],
});
