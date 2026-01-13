import { describe, expect, test, vi } from 'vitest';
import type winston from 'winston';
import type * as stylelint from 'stylelint';

import { createLoggingServiceStub, createTestLogger } from '../../../../../test/helpers/index.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import type { LinterResult, RunnerOptions } from '../../../stylelint/types.js';
import type { WorkerLintResult, WorkerResolveResult } from '../../../worker/types.js';
import { StylelintNotFoundError } from '../../../worker/worker-process.js';
import { loggingServiceToken } from '../../infrastructure/logging.service.js';
import { PackageRootCacheService } from '../package-root-cache.service.js';
import { PnPConfigurationCacheService } from '../pnp-configuration-cache.service.js';
import { WorkerEnvironmentService } from '../worker-environment.service.js';
import { WorkerRegistryService } from '../worker-registry.service.js';
import {
	WorkspaceStylelintService,
	type WorkspaceLintRequest,
} from '../workspace-stylelint.service.js';

type MockWorker = {
	lint: ReturnType<typeof vi.fn>;
	resolve: ReturnType<typeof vi.fn>;
};

type WorkspaceServiceMocks = {
	service: WorkspaceStylelintService;
	worker: MockWorker;
	workerRegistry: {
		runWithWorker: ReturnType<typeof vi.fn>;
		dispose: ReturnType<typeof vi.fn>;
		disposeAll: ReturnType<typeof vi.fn>;
		notifyWorkspaceActivity: ReturnType<typeof vi.fn>;
		notifyFileActivity: ReturnType<typeof vi.fn>;
	};
	workerEnvironment: {
		createKey: ReturnType<typeof vi.fn>;
	};
	packageRootCache: {
		determineWorkerRoot: ReturnType<typeof vi.fn>;
		invalidateForFile: ReturnType<typeof vi.fn>;
		clearForWorkspace: ReturnType<typeof vi.fn>;
		clear: ReturnType<typeof vi.fn>;
	};
	pnpCache: {
		findConfiguration: ReturnType<typeof vi.fn>;
		invalidateForFile: ReturnType<typeof vi.fn>;
		clearForWorkspace: ReturnType<typeof vi.fn>;
		clear: ReturnType<typeof vi.fn>;
	};
	logger: winston.Logger;
};

const createService = (): WorkspaceServiceMocks => {
	const worker: MockWorker = {
		lint: vi.fn(),
		resolve: vi.fn(),
	};
	const runWithWorker = vi.fn(async (_context, executor) => executor(worker as never));
	const workerRegistry = {
		runWithWorker,
		dispose: vi.fn(),
		disposeAll: vi.fn(),
		notifyWorkspaceActivity: vi.fn(),
		notifyFileActivity: vi.fn(),
	} as unknown as WorkerRegistryService;
	const packageRootCache = {
		determineWorkerRoot: vi.fn().mockResolvedValue('/workspace'),
		invalidateForFile: vi.fn(),
		clearForWorkspace: vi.fn(),
		clear: vi.fn(),
	} as unknown as PackageRootCacheService;
	const pnpCache = {
		findConfiguration: vi.fn().mockResolvedValue(undefined),
		invalidateForFile: vi.fn(),
		clearForWorkspace: vi.fn(),
		clear: vi.fn(),
	} as unknown as PnPConfigurationCacheService;
	const workerEnvironment = {
		createKey: vi.fn().mockResolvedValue('env-key'),
	} as unknown as WorkerEnvironmentService;

	const logger = createTestLogger();
	const loggingService = createLoggingServiceStub(logger);
	const container = createContainer(
		module({
			register: [
				provideTestValue(loggingServiceToken, () => loggingService),
				provideTestValue(PackageRootCacheService, () => packageRootCache),
				provideTestValue(PnPConfigurationCacheService, () => pnpCache),
				provideTestValue(WorkerEnvironmentService, () => workerEnvironment),
				provideTestValue(WorkerRegistryService, () => workerRegistry),
				WorkspaceStylelintService,
			],
		}),
	);
	const service = container.resolve(WorkspaceStylelintService);

	return {
		service,
		worker,
		workerRegistry: workerRegistry as unknown as WorkspaceServiceMocks['workerRegistry'],
		workerEnvironment: workerEnvironment as unknown as WorkspaceServiceMocks['workerEnvironment'],
		packageRootCache: packageRootCache as unknown as WorkspaceServiceMocks['packageRootCache'],
		pnpCache: pnpCache as unknown as WorkspaceServiceMocks['pnpCache'],
		logger,
	};
};

describe('WorkspaceStylelintService', () => {
	test('delegates lint requests to the worker registry', async () => {
		const lintResult: WorkerLintResult = {
			resolvedPath: '/workspace/node_modules/stylelint',
			linterResult: { results: [] } satisfies LinterResult,
		};
		const { service, worker, workerRegistry, packageRootCache, pnpCache } = createService();

		worker.lint.mockResolvedValue(lintResult);

		const request: WorkspaceLintRequest = {
			workspaceFolder: '/workspace',
			options: { codeFilename: '/workspace/file.css' } as stylelint.LinterOptions,
			runnerOptions: {} as RunnerOptions,
		};

		await expect(service.lint(request)).resolves.toBe(lintResult);

		expect(packageRootCache.determineWorkerRoot).toHaveBeenCalledWith(
			'/workspace',
			'/workspace/file.css',
			undefined,
		);
		expect(pnpCache.findConfiguration).toHaveBeenCalledWith('/workspace/file.css');
		expect(workerRegistry.runWithWorker).toHaveBeenCalledWith(
			{
				workspaceFolder: '/workspace',
				workerRoot: '/workspace',
				pnpConfig: undefined,
				environmentKey: 'env-key',
			},
			expect.any(Function),
		);
		expect(worker.lint).toHaveBeenCalledWith({
			options: request.options,
			stylelintPath: undefined,
			runnerOptions: request.runnerOptions,
		});
	});

	test('logs debug information when Stylelint is not found during lint', async () => {
		const { service, workerRegistry, logger } = createService();
		const error = new StylelintNotFoundError();

		(workerRegistry.runWithWorker as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			error,
		);

		await expect(
			service.lint({
				workspaceFolder: '/workspace',
				options: {} as stylelint.LinterOptions,
				runnerOptions: {} as RunnerOptions,
			}),
		).rejects.toBe(error);

		expect(logger.debug).toHaveBeenCalledWith('Workspace Stylelint not found', {
			workspaceFolder: '/workspace',
		});
	});

	test('delegates resolve requests to the worker registry', async () => {
		const resolveResult = {
			resolvedPath: '/workspace/node_modules/stylelint',
			entryPath: '/workspace/node_modules/stylelint/index.js',
		} as WorkerResolveResult;
		const { service, worker } = createService();

		worker.resolve.mockResolvedValue(resolveResult);

		await expect(
			service.resolve({
				workspaceFolder: '/workspace',
				stylelintPath: 'stylelint',
				runnerOptions: {} as RunnerOptions,
			}),
		).resolves.toBe(resolveResult);

		expect(worker.resolve).toHaveBeenCalledWith({
			stylelintPath: 'stylelint',
			codeFilename: undefined,
			runnerOptions: {} as RunnerOptions,
		});
	});

	test('disposes caches and workers for a workspace', () => {
		const { service, workerRegistry, packageRootCache, pnpCache } = createService();

		service.dispose('/workspace');

		expect(workerRegistry.dispose).toHaveBeenCalledWith('/workspace');
		expect(packageRootCache.clearForWorkspace).toHaveBeenCalledWith('/workspace');
		expect(pnpCache.clearForWorkspace).toHaveBeenCalledWith('/workspace');
	});

	test('disposes all caches and workers', () => {
		const { service, workerRegistry, packageRootCache, pnpCache } = createService();

		service.disposeAll();

		expect(workerRegistry.disposeAll).toHaveBeenCalled();
		expect(packageRootCache.clear).toHaveBeenCalled();
		expect(pnpCache.clear).toHaveBeenCalled();
	});

	test('notifies worker registry and caches about workspace activity', () => {
		const { service, workerRegistry } = createService();

		service.notifyWorkspaceActivity('/workspace');

		expect(workerRegistry.notifyWorkspaceActivity).toHaveBeenCalledWith('/workspace');
	});

	test('propagates file activity to workers and caches', () => {
		const { service, workerRegistry, packageRootCache, pnpCache } = createService();

		service.notifyFileActivity('/workspace/package.json');

		expect(workerRegistry.notifyFileActivity).toHaveBeenCalledWith('/workspace/package.json');
		expect(packageRootCache.invalidateForFile).toHaveBeenCalledWith('/workspace/package.json');
		expect(pnpCache.invalidateForFile).toHaveBeenCalledWith('/workspace/package.json');
	});
});
