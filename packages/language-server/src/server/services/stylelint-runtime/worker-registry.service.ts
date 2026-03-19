import fs from 'node:fs';
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

// CI-only file-based diagnostic logging. Writes to .stylelint-server-diag.log
// in the workerRoot so the e2e test can capture server-side decisions.
const CI_DIAG = Boolean(process.env.CI);
const CI_DIAG_FILENAME = '.stylelint-server-diag.log';

/**
 * Appends a timestamped diagnostic line to the server diagnostic log.
 * Only writes when the CI environment variable is set.
 */
function ciDiagLog(workerRoot: string, message: string): void {
	if (!CI_DIAG) return;

	try {
		const line = `[${new Date().toISOString()}] [PID:${process.pid}] [WorkerRegistry] ${message}\n`;

		fs.appendFileSync(path.join(workerRoot, CI_DIAG_FILENAME), line);
	} catch {
		// Diagnostics must never break production code.
	}
}

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

		ciDiagLog(
			context.workerRoot,
			`runWithWorker ENTER: wsFolder=${context.workspaceFolder}, workerRoot=${context.workerRoot}, ` +
				`consecutiveCrashes=${record.state.consecutiveCrashes}, cooldownExpiresAt=${record.state.cooldownExpiresAt ?? 'none'}, ` +
				`isDisposed=${record.process.isDisposed()}, now=${Date.now()}`,
		);

		const suppressedError = this.#maybeCreateSuppressedError(
			context.workspaceFolder,
			context.workerRoot,
			record.state,
		);

		if (suppressedError) {
			ciDiagLog(
				context.workerRoot,
				`runWithWorker SUPPRESSED: retryInMs=${suppressedError.retryInMs}, notifyUser=${suppressedError.notifyUser}`,
			);
			throw suppressedError;
		}

		try {
			ciDiagLog(context.workerRoot, `runWithWorker EXECUTING: calling executor`);
			const result = await executor(record.process);

			ciDiagLog(context.workerRoot, `runWithWorker SUCCESS: marking healthy`);
			this.#markWorkerHealthy(record.state);

			return result;
		} catch (error) {
			if (error instanceof StylelintWorkerCrashedError) {
				ciDiagLog(
					context.workerRoot,
					`runWithWorker CRASH: kind=${error.kind}, code=${error.code}, signal=${error.signal}, ` +
						`preCrashCount=${record.state.consecutiveCrashes}`,
				);

				throw this.#handleWorkerCrash(
					context.workspaceFolder,
					context.workerRoot,
					record.state,
					error,
				);
			}

			ciDiagLog(
				context.workerRoot,
				`runWithWorker ERROR (non-crash): ${error instanceof Error ? error.message : String(error)}`,
			);
			throw error;
		}
	}

	notifyWorkspaceActivity(workspaceFolder: string): void {
		const workspaceKey = resolvePathKey(workspaceFolder);

		// Log to the workspace folder since workerRoot is not available externally.
		ciDiagLog(
			workspaceFolder,
			`notifyWorkspaceActivity: wsKey=${workspaceKey}, hasWorkers=${this.#workers.has(workspaceKey)}`,
		);
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
				ciDiagLog(context.workerRoot, `#getWorker: existing worker DISPOSED, creating replacement`);
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
				ciDiagLog(context.workerRoot, `#getWorker: environmentKey MISMATCH, creating replacement`);
				existing.process.dispose();
				const replacement = this.#createWorkerRecord(context);

				packageWorkers.set(pnpKey, replacement);

				return replacement;
			}

			if (context.environmentKey && !existing.environmentKey) {
				existing.environmentKey = context.environmentKey;
			}

			ciDiagLog(
				context.workerRoot,
				`#getWorker: REUSING existing worker, disposed=${existing.process.isDisposed()}, crashes=${existing.state.consecutiveCrashes}`,
			);

			return existing;
		}

		ciDiagLog(context.workerRoot, `#getWorker: CREATING new worker record`);
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

		ciDiagLog(
			workerRoot,
			`#handleWorkerCrash: consecutiveCrashes=${state.consecutiveCrashes}, maxConsecutiveCrashes=${maxConsecutiveCrashes}, ` +
				`cooldownExpiresAt=${state.cooldownExpiresAt ?? 'none'}, kind=${error.kind}`,
		);

		if (state.consecutiveCrashes < maxConsecutiveCrashes) {
			return error;
		}

		const now = Date.now();

		if (!state.cooldownExpiresAt || now >= state.cooldownExpiresAt) {
			state.cooldownExpiresAt = now + workerRecoveryCooldownMs;
			state.lastNotificationAt = undefined;

			ciDiagLog(
				workerRoot,
				`#handleWorkerCrash: ENTERING COOLDOWN, expiresAt=${state.cooldownExpiresAt}, cooldownMs=${workerRecoveryCooldownMs}`,
			);

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
			ciDiagLog(workerRoot, `#maybeCreateSuppressedError: no cooldown, allowing`);

			return undefined;
		}

		const now = Date.now();

		if (now >= cooldown) {
			ciDiagLog(
				workerRoot,
				`#maybeCreateSuppressedError: cooldown EXPIRED (expired=${cooldown}, now=${now}), clearing state`,
			);
			state.cooldownExpiresAt = undefined;
			state.consecutiveCrashes = 0;
			state.lastNotificationAt = undefined;

			return undefined;
		}

		ciDiagLog(
			workerRoot,
			`#maybeCreateSuppressedError: cooldown ACTIVE (expiresAt=${cooldown}, now=${now}, remainingMs=${cooldown - now})`,
		);

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
					ciDiagLog(
						packageKey,
						`#releaseSuppressedWorker: CLEARED cooldown for wsKey=${workspaceKey}, pkgKey=${packageKey}, pnpKey=${pnpKey}`,
					);
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
