import type stylelint from 'stylelint';
import type winston from 'winston';

import { inject } from '../../../di/index.js';
import type { RunnerOptions } from '../../stylelint/types.js';
import type { WorkerLintResult, WorkerResolveResult } from '../../worker/types.js';
import { StylelintNotFoundError } from '../../worker/worker-process.js';
import { type LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';
import { PackageRootCacheService } from './package-root-cache.service.js';
import { PnPConfigurationCacheService } from './pnp-configuration-cache.service.js';
import { WorkerRegistryService } from './worker-registry.service.js';

export type WorkspaceLintRequest = {
	workspaceFolder: string;
	options: stylelint.LinterOptions;
	stylelintPath?: string;
	runnerOptions: RunnerOptions;
};

export type WorkspaceResolveRequest = {
	workspaceFolder: string;
	stylelintPath?: string;
	codeFilename?: string;
	runnerOptions?: RunnerOptions;
};

@inject({
	inject: [
		loggingServiceToken,
		PackageRootCacheService,
		PnPConfigurationCacheService,
		WorkerRegistryService,
	],
})
export class WorkspaceStylelintService {
	#logger?: winston.Logger;
	readonly #packageRootCache: PackageRootCacheService;
	readonly #pnpConfigurationCache: PnPConfigurationCacheService;
	readonly #workerRegistry: WorkerRegistryService;

	constructor(
		loggingService: LoggingService,
		packageRootCache: PackageRootCacheService,
		pnpConfigurationCache: PnPConfigurationCacheService,
		workerRegistry: WorkerRegistryService,
	) {
		this.#logger = loggingService.createLogger(WorkspaceStylelintService);
		this.#packageRootCache = packageRootCache;
		this.#pnpConfigurationCache = pnpConfigurationCache;
		this.#workerRegistry = workerRegistry;
	}

	async lint(request: WorkspaceLintRequest): Promise<WorkerLintResult | undefined> {
		const pnpConfig = await this.#pnpConfigurationCache.findConfiguration(
			request.options.codeFilename,
		);
		const workerRoot = await this.#packageRootCache.determineWorkerRoot(
			request.workspaceFolder,
			request.options.codeFilename,
			request.stylelintPath,
		);

		try {
			return await this.#workerRegistry.runWithWorker(
				{
					workspaceFolder: request.workspaceFolder,
					workerRoot,
					pnpConfig,
				},
				async (worker) =>
					await worker.lint({
						options: request.options,
						stylelintPath: request.stylelintPath,
						runnerOptions: request.runnerOptions,
					}),
			);
		} catch (error) {
			if (error instanceof StylelintNotFoundError) {
				this.#logger?.debug('Workspace Stylelint not found', {
					workspaceFolder: request.workspaceFolder,
				});
			}

			throw error;
		}
	}

	async resolve(request: WorkspaceResolveRequest): Promise<WorkerResolveResult | undefined> {
		const pnpConfig = await this.#pnpConfigurationCache.findConfiguration(request.codeFilename);
		const workerRoot = await this.#packageRootCache.determineWorkerRoot(
			request.workspaceFolder,
			request.codeFilename,
			request.stylelintPath,
		);

		try {
			return await this.#workerRegistry.runWithWorker(
				{
					workspaceFolder: request.workspaceFolder,
					workerRoot,
					pnpConfig,
				},
				async (worker) =>
					await worker.resolve({
						stylelintPath: request.stylelintPath,
						codeFilename: request.codeFilename,
						runnerOptions: request.runnerOptions,
					}),
			);
		} catch (error) {
			if (error instanceof StylelintNotFoundError) {
				this.#logger?.debug('Workspace Stylelint not found during resolve', {
					workspaceFolder: request.workspaceFolder,
				});
			}

			throw error;
		}
	}

	dispose(workspaceFolder: string): void {
		this.#workerRegistry.dispose(workspaceFolder);
		this.#packageRootCache.clearForWorkspace(workspaceFolder);
		this.#pnpConfigurationCache.clearForWorkspace(workspaceFolder);
	}

	disposeAll(): void {
		this.#workerRegistry.disposeAll();
		this.#packageRootCache.clear();
		this.#pnpConfigurationCache.clear();
	}

	notifyWorkspaceActivity(workspaceFolder: string): void {
		this.#workerRegistry.notifyWorkspaceActivity(workspaceFolder);
	}

	notifyFileActivity(filePath: string | undefined): void {
		this.#workerRegistry.notifyFileActivity(filePath);
		this.#packageRootCache.invalidateForFile(filePath);
		this.#pnpConfigurationCache.invalidateForFile(filePath);
	}
}
