import type { Connection } from 'vscode-languageserver';

import type { InjectionToken } from '../../di/inject.js';
import type { ModuleMetadata } from '../../di/module.js';
import { createRuntimeApplication, type RuntimeApplication } from '../../di/runtime/index.js';
import { lspConnectionToken } from '../tokens.js';
import { createLanguageServerFeature } from './language-server-feature.js';

export interface LanguageServerApplicationFactories {
	createRuntimeApplication?: typeof createRuntimeApplication;
	createLanguageServerFeature?: typeof createLanguageServerFeature;
}

export interface LanguageServerApplicationOptions {
	connection: Connection;
	modules: ModuleMetadata[];
	overrides?: Iterable<[InjectionToken<unknown>, unknown]>;
	factories?: LanguageServerApplicationFactories;
}

/**
 * Creates the runtime application responsible for hosting the language server services.
 */
export function createLanguageServerApplication(
	options: LanguageServerApplicationOptions,
): RuntimeApplication {
	const overrides = new Map(options.overrides ?? []);
	const runtimeFactory = options.factories?.createRuntimeApplication ?? createRuntimeApplication;
	const featureFactory =
		options.factories?.createLanguageServerFeature ?? createLanguageServerFeature;

	overrides.set(lspConnectionToken, options.connection);

	const application = runtimeFactory({
		modules: options.modules,
		overrides,
		features: [featureFactory({ connection: options.connection })],
	});

	options.connection.onShutdown(() => {
		void application.dispose();
	});

	return application;
}
