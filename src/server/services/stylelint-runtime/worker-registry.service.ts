import path from 'node:path';
import process from 'node:process';
import type winston from 'winston';

import { inject } from '../../../di/index.js';
import { normalizeFsPath } from '../../utils/index.js';
import type { PnPConfiguration } from '../../types.js';
import {
	StylelintWorkerCrashedError,
	StylelintWorkerProcess,
	StylelintWorkerUnavailableError,
} from '../../worker/worker-process.js';
import { type LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';
import { resolvePnPConfigKey } from './pnp-configuration-cache.service.js';
import { WorkerProcessService } from './worker-process.service.js';

const maxConsecutiveCrashes = 3;
const workerRecoveryCooldownMs = 30 * 1000;
const suppressionNotificationIntervalMs = 60 * 1000;

type WorkspaceKey = string;
type PackageKey = string;
type PnPConfigKey = string;

export type WorkerContext = {
	workspaceFolder: string;
	workerRoot: string;
	pnpConfig?: PnPConfiguration;
	environmentKey?: string;
};

type WorkerHealthState = {
	consecutiveCrashes: number;
	cooldownExpiresAt?: number;
	lastCrashError?: StylelintWorkerCrashedError;
	lastNotificationAt?: number;
};

type WorkerRecord = {
	process: StylelintWorkerProcess;
	environmentKey?: string;
	state: WorkerHealthState;
};

type WorkerMap = Map<WorkspaceKey, Map<PackageKey, Map<PnPConfigKey, WorkerRecord>>>;

const resolvePathKey = (folderPath: string): WorkspaceKey => {
	const normalized = normalizeFsPath(folderPath);

	return normalized ?? path.resolve(folderPath);
};

@inject({
	inject: [loggingServiceToken, WorkerProcessService],
})
export class WorkerRegistryService {
	#logger?: winston.Logger;
	#idleTimeoutMs?: number;
	readonly #workers: WorkerMap = new Map();
	readonly #workerProcessFactory: WorkerProcessService;

	constructor(loggingService: LoggingService, workerFactory: WorkerProcessService) {
		this.#logger = loggingService.createLogger(WorkerRegistryService);
		this.#workerProcessFactory = workerFactory;
	}

	async runWithWorker<T>(
		context: WorkerContext,
		executor: (worker: StylelintWorkerProcess) => Promise<T>,
	): Promise<T> {
		const record = this.#getWorker(context);
		const suppressedError = this.#maybeCreateSuppressedError(
			context.workspaceFolder,
			context.workerRoot,
			record.state,
		);

		if (suppressedError) {
			throw suppressedError;
		}

		try {
			const result = await executor(record.process);

			this.#markWorkerHealthy(record.state);

			return result;
		} catch (error) {
			if (error instanceof StylelintWorkerCrashedError) {
				throw this.#handleWorkerCrash(
					context.workspaceFolder,
					context.workerRoot,
					record.state,
					error,
				);
			}

			throw error;
		}
	}

	notifyWorkspaceActivity(workspaceFolder: string): void {
		const workspaceKey = resolvePathKey(workspaceFolder);

		this.#resetWorkspaceWorkers(workspaceKey);
	}

	notifyFileActivity(filePath: string | undefined): void {
		const normalized = normalizeFsPath(filePath);

		if (!normalized) {
			return;
		}

		const absolute = path.isAbsolute(normalized) ? normalized : path.resolve(normalized);

		for (const workspaceKey of this.#workers.keys()) {
			if (this.#pathWithinWorkspace(workspaceKey, absolute)) {
				this.#resetWorkspaceWorkers(workspaceKey);
			}
		}
	}

	dispose(workspaceFolder: string): void {
		const workspaceKey = resolvePathKey(workspaceFolder);
		const workers = this.#workers.get(workspaceKey);

		if (!workers) {
			return;
		}

		for (const packageWorkers of workers.values()) {
			for (const record of packageWorkers.values()) {
				record.process.dispose();
			}
		}

		this.#workers.delete(workspaceKey);
	}

	disposeAll(): void {
		for (const workers of this.#workers.values()) {
			for (const packageWorkers of workers.values()) {
				for (const record of packageWorkers.values()) {
					record.process.dispose();
				}
			}
		}

		this.#workers.clear();
	}

	#getWorker(context: WorkerContext): WorkerRecord {
		const workspaceKey = resolvePathKey(context.workspaceFolder);
		let workspaceWorkers = this.#workers.get(workspaceKey);

		if (!workspaceWorkers) {
			workspaceWorkers = new Map();
			this.#workers.set(workspaceKey, workspaceWorkers);
		}

		const packageKey = resolvePathKey(context.workerRoot);
		let packageWorkers = workspaceWorkers.get(packageKey);

		if (!packageWorkers) {
			packageWorkers = new Map();
			workspaceWorkers.set(packageKey, packageWorkers);
		}

		const pnpKey = resolvePnPConfigKey(context.pnpConfig);
		const existing = packageWorkers.get(pnpKey);

		if (existing) {
			if (existing.process.isDisposed()) {
				existing.process.dispose();
				const replacement = this.#createWorkerRecord(context);

				packageWorkers.set(pnpKey, replacement);

				return replacement;
			}

			if (
				context.environmentKey &&
				existing.environmentKey &&
				existing.environmentKey !== context.environmentKey
			) {
				existing.process.dispose();
				const replacement = this.#createWorkerRecord(context);

				packageWorkers.set(pnpKey, replacement);

				return replacement;
			}

			if (context.environmentKey && !existing.environmentKey) {
				existing.environmentKey = context.environmentKey;
			}

			return existing;
		}

		const record = this.#createWorkerRecord(context);

		packageWorkers.set(pnpKey, record);

		return record;
	}

	#createWorkerRecord(context: WorkerContext): WorkerRecord {
		const worker = this.#workerProcessFactory.createWorkerProcess(
			context.workerRoot,
			this.#idleTimeoutMs,
			context.pnpConfig,
		);

		return {
			process: worker,
			environmentKey: context.environmentKey,
			state: {
				consecutiveCrashes: 0,
			},
		};
	}

	#markWorkerHealthy(state: WorkerHealthState): void {
		if (
			state.consecutiveCrashes === 0 &&
			state.cooldownExpiresAt === undefined &&
			state.lastCrashError === undefined
		) {
			return;
		}

		state.consecutiveCrashes = 0;
		state.cooldownExpiresAt = undefined;
		state.lastCrashError = undefined;
		state.lastNotificationAt = undefined;
	}

	#handleWorkerCrash(
		workspaceFolder: string,
		workerRoot: string,
		state: WorkerHealthState,
		error: StylelintWorkerCrashedError,
	): Error {
		state.consecutiveCrashes += 1;
		state.lastCrashError = error;

		if (state.consecutiveCrashes < maxConsecutiveCrashes) {
			return error;
		}

		const now = Date.now();

		if (!state.cooldownExpiresAt || now >= state.cooldownExpiresAt) {
			state.cooldownExpiresAt = now + workerRecoveryCooldownMs;
			state.lastNotificationAt = undefined;

			this.#logger?.warn('Stylelint worker entered cooldown after repeated crashes', {
				workspaceFolder,
				packageRoot: workerRoot,
				consecutiveCrashes: state.consecutiveCrashes,
			});
		}

		return this.#buildUnavailableError(workspaceFolder, workerRoot, state, now);
	}

	#maybeCreateSuppressedError(
		workspaceFolder: string,
		workerRoot: string,
		state: WorkerHealthState,
	): StylelintWorkerUnavailableError | undefined {
		const cooldown = state.cooldownExpiresAt;

		if (!cooldown) {
			return undefined;
		}

		const now = Date.now();

		if (now >= cooldown) {
			state.cooldownExpiresAt = undefined;
			state.consecutiveCrashes = 0;
			state.lastNotificationAt = undefined;

			return undefined;
		}

		return this.#buildUnavailableError(workspaceFolder, workerRoot, state, now);
	}

	#buildUnavailableError(
		workspaceFolder: string,
		workerRoot: string,
		state: WorkerHealthState,
		now: number,
	): StylelintWorkerUnavailableError {
		const retryInMs = Math.max(0, (state.cooldownExpiresAt ?? now) - now);
		const notifyUser = this.#shouldNotifySuppression(state, now);

		return new StylelintWorkerUnavailableError({
			workspaceFolder,
			packageRoot: workerRoot,
			retryInMs,
			notifyUser,
			lastCrashError: state.lastCrashError,
		});
	}

	#shouldNotifySuppression(state: WorkerHealthState, now: number): boolean {
		if (!state.lastNotificationAt) {
			state.lastNotificationAt = now;

			return true;
		}

		if (now - state.lastNotificationAt >= suppressionNotificationIntervalMs) {
			state.lastNotificationAt = now;

			return true;
		}

		return false;
	}

	#resetWorkspaceWorkers(workspaceKey: WorkspaceKey): void {
		const workers = this.#workers.get(workspaceKey);

		if (!workers) {
			return;
		}

		for (const [packageKey, packageWorkers] of workers.entries()) {
			for (const [pnpKey, record] of packageWorkers.entries()) {
				if (this.#releaseSuppressedWorker(record.state)) {
					this.#logger?.debug('Resetting Stylelint worker after workspace activity', {
						workspaceFolder: workspaceKey,
						packageRoot: packageKey,
						pnpKey,
					});
				}
			}
		}
	}

	#releaseSuppressedWorker(state: WorkerHealthState): boolean {
		if (!state.cooldownExpiresAt) {
			return false;
		}

		state.cooldownExpiresAt = undefined;
		state.consecutiveCrashes = 0;
		state.lastNotificationAt = undefined;

		return true;
	}

	#pathWithinWorkspace(workspaceKey: WorkspaceKey, targetPath: string): boolean {
		const normalizedTarget = normalizeFsPath(path.resolve(targetPath));

		if (!normalizedTarget) {
			return false;
		}

		const normalizedWorkspace = normalizeFsPath(workspaceKey) ?? workspaceKey;
		const normalizeValue = (value: string): string =>
			process.platform === 'win32' ? value.toLowerCase() : value;
		const comparableWorkspace = normalizeValue(normalizedWorkspace);
		const comparableTarget = normalizeValue(normalizedTarget);

		if (comparableTarget === comparableWorkspace) {
			return true;
		}

		return comparableTarget.startsWith(`${comparableWorkspace}${path.sep}`);
	}
}
