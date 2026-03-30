import type { Connection } from 'vscode-languageserver';
import type winston from 'winston';
import { inject } from '../../../di/index.js';
import { mergeOptionsWithDefaults } from '../../utils/index.js';
import { defaultLanguageServerOptions } from '../../config/default-options.js';
import { lspConnectionToken } from '../../tokens.js';
import type { LanguageServerOptions } from '../../types.js';
import { type LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';

/**
 * Extracts Stylelint settings from the given configuration object.
 */
function extractStylelintSettings(settings: unknown): unknown {
	if (!settings || typeof settings !== 'object') {
		return undefined;
	}

	if ('stylelint' in settings) {
		return (settings as { stylelint?: unknown }).stylelint;
	}

	return settings;
}

/**
 * How long, in milliseconds, a resolved scoped option is kept in cache before
 * the next call triggers a fresh `workspace/configuration` RPC.
 */
const optionsCacheTtl = 2000;

type CachedOptions = {
	options: LanguageServerOptions;
	expiresAt: number;
};

@inject({
	inject: [lspConnectionToken, loggingServiceToken],
})
export class WorkspaceOptionsService {
	#connection: Connection;
	#logger?: winston.Logger;
	#supportsScopedConfiguration = false;
	#globalOptions: LanguageServerOptions = mergeOptionsWithDefaults(
		{},
		defaultLanguageServerOptions,
	);
	#inFlightRequests = new Map<string, Promise<LanguageServerOptions>>();
	#cachedOptions = new Map<string, CachedOptions>();

	constructor(connection: Connection, loggingService: LoggingService) {
		this.#connection = connection;
		this.#logger = loggingService.createLogger(WorkspaceOptionsService);
	}

	setSupportsWorkspaceConfiguration(supported: boolean): void {
		this.#supportsScopedConfiguration = supported;

		if (!supported) {
			this.clearCache();
		}
	}

	#buildOptions(configuration: unknown): LanguageServerOptions {
		const merged = mergeOptionsWithDefaults(
			extractStylelintSettings(configuration) ?? {},
			defaultLanguageServerOptions,
		);

		Object.freeze(merged);

		return merged;
	}

	updateGlobalOptions(settings: unknown): void {
		this.#globalOptions = this.#buildOptions(settings);
	}

	clearCache(): void {
		this.#inFlightRequests.clear();
		this.#cachedOptions.clear();
	}

	delete(resource: string): void {
		this.#inFlightRequests.delete(resource);
		this.#cachedOptions.delete(resource);
	}

	async getOptions(resource: string): Promise<LanguageServerOptions> {
		if (!this.#supportsScopedConfiguration) {
			return this.#globalOptions;
		}

		// Return from TTL cache if still fresh.
		const cached = this.#cachedOptions.get(resource);

		if (cached && Date.now() < cached.expiresAt) {
			return cached.options;
		}

		// Deduplicate concurrent in-flight requests for the same resource.
		let request = this.#inFlightRequests.get(resource);

		if (!request) {
			request = this.#requestScopedOptions(resource);
			this.#inFlightRequests.set(resource, request);

			request
				.then((options) => {
					this.#cachedOptions.set(resource, {
						options,
						expiresAt: Date.now() + optionsCacheTtl,
					});
				})
				.catch(() => undefined)
				.finally(() => {
					this.#inFlightRequests.delete(resource);
				});
		}

		return request;
	}

	async #requestScopedOptions(resource: string): Promise<LanguageServerOptions> {
		this.#logger?.debug('Requesting workspace options from client', { resource });

		const configuration = (await this.#connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'stylelint',
		})) as unknown;

		return this.#buildOptions(configuration);
	}
}
