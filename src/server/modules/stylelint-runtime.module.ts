// @no-unit-test -- Module definition file that does not need unit tests.

import { module } from '../../di/index.js';
import {
	GlobalPathResolverService,
	PackageRootCacheService,
	PackageRootService,
	PnPConfigurationCacheService,
	ProcessRunnerService,
	StylelintOptionsService,
	StylelintRunnerService,
	WorkerProcessService,
	WorkerRegistryService,
	WorkspaceStylelintService,
} from '../services/stylelint-runtime/index.js';

export const stylelintRuntimeModule = module({
	register: [
		ProcessRunnerService,
		GlobalPathResolverService,
		PackageRootService,
		PackageRootCacheService,
		PnPConfigurationCacheService,
		WorkerProcessService,
		WorkerRegistryService,
		WorkspaceStylelintService,
		StylelintOptionsService,
		StylelintRunnerService,
	],
});
