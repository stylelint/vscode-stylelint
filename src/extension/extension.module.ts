// @no-unit-test -- Module definition file that only composes providers.

import { module, provideValue } from '../di/index.js';
import { extensionTokens } from './di-tokens.js';
import { ExtensionRuntimeService } from './extension-runtime.service.js';
import {
	createClientOptions,
	createLanguageClient,
	createPublicApi,
	createServerOptions,
	createSettingMonitorFactory,
} from './services/index.js';

export const extensionModule = module({
	register: [
		{
			token: extensionTokens.serverOptions,
			inject: [extensionTokens.serverModulePath, extensionTokens.workspace],
			useFactory: createServerOptions,
		},
		{
			token: extensionTokens.clientOptions,
			inject: [extensionTokens.workspace],
			useFactory: createClientOptions,
		},
		{
			token: extensionTokens.settingMonitorFactory,
			inject: [extensionTokens.languageClientModule],
			useFactory: createSettingMonitorFactory,
		},
		{
			token: extensionTokens.languageClient,
			inject: [
				extensionTokens.languageClientModule,
				extensionTokens.serverOptions,
				extensionTokens.clientOptions,
			],
			useFactory: createLanguageClient,
		},
		provideValue(extensionTokens.publicApi, createPublicApi),
		ExtensionRuntimeService,
	],
});
