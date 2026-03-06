// @no-unit-test -- Module definition file that only composes providers.

import { module, provideValue } from '../di/index.js';
import { extensionTokens } from './di-tokens.js';
import { ExtensionRuntimeService } from './extension-runtime.service.js';
import {
	createClientOptions,
	createPublicApi,
	LanguageClientService,
	ServerOptionsService,
} from './services/index.js';

export const extensionModule = module({
	register: [
		ServerOptionsService,
		LanguageClientService,
		{
			token: extensionTokens.clientOptions,
			inject: [extensionTokens.workspace, extensionTokens.window],
			useFactory: createClientOptions,
		},
		provideValue(extensionTokens.publicApi, createPublicApi),
		ExtensionRuntimeService,
	],
});
