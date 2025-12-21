// @no-unit-test -- Simple bootstrap code not needing unit tests; tested via integration tests.

import type { Connection } from 'vscode-languageserver';
import winston from 'winston';

import { module } from '../di/index.js';
import { platformModule } from './modules/index.js';
import { createLanguageServerApplication } from './runtime/application.js';
import { languageServerModule } from './server.module.js';
import { createWinstonLoggingService, winstonToken } from './services/index.js';
import type { LogLevel } from '../shared/log-level.js';

export interface StylelintLanguageServerOptions {
	connection: Connection;
	logLevel?: LogLevel;
	logPath?: string;
}

export class StylelintLanguageServer {
	#application?: ReturnType<typeof createLanguageServerApplication>;
	readonly #options: StylelintLanguageServerOptions;

	constructor(options: StylelintLanguageServerOptions) {
		this.#options = options;
	}

	async start(): Promise<void> {
		if (this.#application) {
			return;
		}

		const featureModule = module({
			imports: [languageServerModule],
			register: [
				createWinstonLoggingService(this.#options.logLevel ?? 'info', this.#options.logPath),
			],
		});

		this.#application = createLanguageServerApplication({
			connection: this.#options.connection,
			modules: [platformModule, featureModule],
			overrides: [[winstonToken, winston]],
		});

		await this.#application.start();
		this.#options.connection.listen();
	}

	async dispose(): Promise<void> {
		await this.#application?.dispose();
		this.#application = undefined;
		this.#options.connection.dispose();
	}
}
