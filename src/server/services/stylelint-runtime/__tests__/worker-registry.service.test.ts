import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { createLoggingServiceStub, createTestLogger } from '../../../../../test/helpers/index.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import {
	StylelintWorkerCrashedError,
	StylelintWorkerUnavailableError,
	type StylelintWorkerProcess,
} from '../../../worker/worker-process.js';
import { loggingServiceToken } from '../../infrastructure/logging.service.js';
import { WorkerProcessService } from '../worker-process.service.js';
import { WorkerRegistryService, type WorkerContext } from '../worker-registry.service.js';

type WorkerLintRequest = Parameters<StylelintWorkerProcess['lint']>[0];

type MockWorker = {
	lint: ReturnType<typeof vi.fn>;
	resolve: ReturnType<typeof vi.fn>;
	dispose: ReturnType<typeof vi.fn>;
	isDisposed: ReturnType<typeof vi.fn>;
};

const createMockWorker = (): MockWorker => ({
	lint: vi.fn(),
	resolve: vi.fn(),
	dispose: vi.fn(),
	isDisposed: vi.fn(() => false),
});

const executeLint = async (process: StylelintWorkerProcess) =>
	process.lint({} as WorkerLintRequest);

const createWorkerFactory = (workers: MockWorker[]) => {
	const createdWorkers: MockWorker[] = [];
	const factory = vi.fn((_workerRoot: string) => {
		const worker = workers.shift() ?? createMockWorker();

		createdWorkers.push(worker);

		return worker as unknown as StylelintWorkerProcess;
	});

	return { factory, createdWorkers };
};

const createRegistry = (workers: MockWorker[]) => {
	const logger = createTestLogger();
	const loggingService = createLoggingServiceStub(logger);
	const { factory } = createWorkerFactory(workers);
	const workerProcessService = {
		createWorkerProcess: factory,
	} as unknown as WorkerProcessService;
	const container = createContainer(
		module({
			register: [
				provideTestValue(loggingServiceToken, () => loggingService),
				provideTestValue(WorkerProcessService, () => workerProcessService),
				WorkerRegistryService,
			],
		}),
	);
	const registry = container.resolve(WorkerRegistryService);

	return { registry, factory, logger };
};

const createCrashError = (workerRoot: string): StylelintWorkerCrashedError =>
	new StylelintWorkerCrashedError('Worker crashed', {
		workerRoot,
		kind: 'exit',
	});

describe('WorkerRegistryService', () => {
	test('reuses a worker for repeated executions within the same workspace', async () => {
		const worker = createMockWorker();
		const runResult = Symbol('result');

		worker.lint.mockResolvedValue(runResult);

		const { registry, factory } = createRegistry([worker]);
		const context: WorkerContext = {
			workspaceFolder: '/workspace',
			workerRoot: '/workspace',
		};

		await expect(registry.runWithWorker(context, executeLint)).resolves.toBe(runResult);
		await expect(registry.runWithWorker(context, executeLint)).resolves.toBe(runResult);

		expect(factory).toHaveBeenCalledTimes(1);
		expect(worker.lint).toHaveBeenCalledTimes(2);
	});

	test('creates distinct workers for different package roots', async () => {
		const firstWorker = createMockWorker();
		const secondWorker = createMockWorker();
		const { registry, factory } = createRegistry([firstWorker, secondWorker]);
		const baseContext = {
			workspaceFolder: '/workspace',
		} as const;

		firstWorker.lint.mockResolvedValue('one');
		secondWorker.lint.mockResolvedValue('two');

		await expect(
			registry.runWithWorker(
				{ ...baseContext, workerRoot: '/workspace/packages/app' },
				executeLint,
			),
		).resolves.toBe('one');
		await expect(
			registry.runWithWorker(
				{ ...baseContext, workerRoot: '/workspace/packages/lib' },
				executeLint,
			),
		).resolves.toBe('two');

		expect(factory).toHaveBeenCalledTimes(2);
		expect(factory).toHaveBeenNthCalledWith(1, '/workspace/packages/app', undefined, undefined);
		expect(factory).toHaveBeenNthCalledWith(2, '/workspace/packages/lib', undefined, undefined);
	});

	test('restarts a worker when the environment key changes', async () => {
		const firstWorker = createMockWorker();
		const secondWorker = createMockWorker();
		const { registry, factory } = createRegistry([firstWorker, secondWorker]);
		const baseContext: WorkerContext = {
			workspaceFolder: '/workspace',
			workerRoot: '/workspace',
			environmentKey: 'one',
		};

		firstWorker.lint.mockResolvedValue('first');
		secondWorker.lint.mockResolvedValue('second');

		await registry.runWithWorker(baseContext, executeLint);

		await expect(
			registry.runWithWorker({ ...baseContext, environmentKey: 'two' }, executeLint),
		).resolves.toBe('second');

		expect(firstWorker.dispose).toHaveBeenCalledTimes(1);
		expect(factory).toHaveBeenCalledTimes(2);
	});

	test('recreates a worker that was disposed due to idling', async () => {
		const firstWorker = createMockWorker();
		const secondWorker = createMockWorker();
		const { registry, factory } = createRegistry([firstWorker, secondWorker]);
		const context: WorkerContext = {
			workspaceFolder: '/workspace',
			workerRoot: '/workspace',
		};

		firstWorker.lint.mockResolvedValue('first');
		secondWorker.lint.mockResolvedValue('second');

		await expect(registry.runWithWorker(context, executeLint)).resolves.toBe('first');

		firstWorker.isDisposed.mockReturnValue(true);
		await expect(registry.runWithWorker(context, executeLint)).resolves.toBe('second');

		expect(firstWorker.dispose).toHaveBeenCalledTimes(1);
		expect(secondWorker.lint).toHaveBeenCalledTimes(1);
		expect(factory).toHaveBeenCalledTimes(2);
	});

	test('creates a new worker after disposing a workspace', async () => {
		const firstWorker = createMockWorker();
		const secondWorker = createMockWorker();
		const { registry, factory } = createRegistry([firstWorker, secondWorker]);
		const context: WorkerContext = {
			workspaceFolder: '/workspace',
			workerRoot: '/workspace',
		};

		firstWorker.lint.mockResolvedValue('lint');
		secondWorker.lint.mockResolvedValue('lint');

		await registry.runWithWorker(context, executeLint);
		registry.dispose('/workspace');
		await registry.runWithWorker(context, executeLint);

		expect(firstWorker.dispose).toHaveBeenCalledTimes(1);
		expect(secondWorker.lint).toHaveBeenCalledTimes(1);
		expect(factory).toHaveBeenCalledTimes(2);
	});

	test('disposes every worker when disposeAll is called', async () => {
		const firstWorker = createMockWorker();
		const secondWorker = createMockWorker();
		const { registry, factory } = createRegistry([firstWorker, secondWorker]);

		firstWorker.lint.mockResolvedValue('lint-1');
		secondWorker.lint.mockResolvedValue('lint-2');

		await registry.runWithWorker({ workspaceFolder: '/one', workerRoot: '/one' }, executeLint);
		await registry.runWithWorker({ workspaceFolder: '/two', workerRoot: '/two' }, executeLint);

		registry.disposeAll();

		expect(firstWorker.dispose).toHaveBeenCalledTimes(1);
		expect(secondWorker.dispose).toHaveBeenCalledTimes(1);

		await registry.runWithWorker({ workspaceFolder: '/one', workerRoot: '/one' }, executeLint);

		expect(factory).toHaveBeenCalledTimes(3);
	});

	test('enters cooldown after repeated crashes and can be reset via workspace activity', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

		try {
			const worker = createMockWorker();
			const crashError = createCrashError('/workspace');
			const { registry } = createRegistry([worker]);
			const context: WorkerContext = {
				workspaceFolder: '/workspace',
				workerRoot: '/workspace',
			};

			worker.lint.mockRejectedValue(crashError);

			await expect(registry.runWithWorker(context, executeLint)).rejects.toBe(crashError);
			await expect(registry.runWithWorker(context, executeLint)).rejects.toBe(crashError);

			const suppressionError = (await registry
				.runWithWorker(context, executeLint)
				.catch((error) => error)) as StylelintWorkerUnavailableError;

			expect(suppressionError).toBeInstanceOf(StylelintWorkerUnavailableError);
			expect(suppressionError.notifyUser).toBe(true);

			const throttledError = (await registry
				.runWithWorker(context, executeLint)
				.catch((error) => error)) as StylelintWorkerUnavailableError;

			expect(throttledError).toBeInstanceOf(StylelintWorkerUnavailableError);
			expect(throttledError.notifyUser).toBe(false);

			registry.notifyWorkspaceActivity('/workspace');

			await expect(registry.runWithWorker(context, executeLint)).rejects.toBe(crashError);
		} finally {
			vi.useRealTimers();
		}
	});

	test('file activity only resets suppressed workers in matching workspaces', async () => {
		vi.useFakeTimers();

		try {
			const workspaceA = path.resolve('/workspace-a');
			const workspaceB = path.resolve('/workspace-b');
			const workerA = createMockWorker();
			const workerB = createMockWorker();
			const { registry } = createRegistry([workerA, workerB]);
			const contextA: WorkerContext = {
				workspaceFolder: workspaceA,
				workerRoot: workspaceA,
			};
			const contextB: WorkerContext = {
				workspaceFolder: workspaceB,
				workerRoot: workspaceB,
			};

			workerA.lint.mockRejectedValue(createCrashError(workspaceA));
			workerB.lint.mockRejectedValue(createCrashError(workspaceB));

			const expectedErrors = [
				StylelintWorkerCrashedError,
				StylelintWorkerCrashedError,
				StylelintWorkerUnavailableError,
			];

			for (const ExpectedError of expectedErrors) {
				await expect(registry.runWithWorker(contextA, executeLint)).rejects.toBeInstanceOf(
					ExpectedError,
				);
			}

			for (const ExpectedError of expectedErrors) {
				await expect(registry.runWithWorker(contextB, executeLint)).rejects.toBeInstanceOf(
					ExpectedError,
				);
			}

			registry.notifyFileActivity(path.join(workspaceA, 'config.json'));

			await expect(registry.runWithWorker(contextA, executeLint)).rejects.toBeInstanceOf(
				StylelintWorkerCrashedError,
			);

			const suppressedB = (await registry
				.runWithWorker(contextB, executeLint)
				.catch((error) => error)) as StylelintWorkerUnavailableError;

			expect(suppressedB).toBeInstanceOf(StylelintWorkerUnavailableError);
			expect(suppressedB.notifyUser).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});
});
