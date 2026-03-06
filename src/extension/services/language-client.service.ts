import type { LanguageClient, LanguageClientOptions } from 'vscode-languageclient/node';

import { inject } from '../../di/index.js';
import { extensionTokens } from '../di-tokens.js';
import type { LanguageClientModule } from './environment.js';
import { ServerOptionsService } from './server-options.service.js';

@inject({
	inject: [
		extensionTokens.languageClientModule,
		ServerOptionsService,
		extensionTokens.clientOptions,
	],
})
export class LanguageClientService {
	readonly #languageClientModule: LanguageClientModule;
	readonly #serverOptionsService: ServerOptionsService;
	readonly #clientOptions: LanguageClientOptions;

	constructor(
		languageClientModule: LanguageClientModule,
		serverOptionsService: ServerOptionsService,
		clientOptions: LanguageClientOptions,
	) {
		this.#languageClientModule = languageClientModule;
		this.#serverOptionsService = serverOptionsService;
		this.#clientOptions = clientOptions;
	}

	createClient(): LanguageClient {
		return new this.#languageClientModule.LanguageClient(
			'Stylelint',
			this.#serverOptionsService.getServerOptions(),
			this.#clientOptions,
		);
	}
}
