// @no-unit-test -- Tightly coupled to worker process environment, covered by integration tests.

import { fork, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import type winston from 'winston';

import {
	stylelintNotFoundError,
	type SerializedWorkerError,
	type WorkerLintPayload,
	type WorkerLintResult,
	type WorkerRequest,
	type WorkerResolveConfigPayload,
	type WorkerResolveConfigResult,
	type WorkerResolvePayload,
	type WorkerResolveResult,
	type WorkerResponse,
} from './types.js';

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
		const line = `[${new Date().toISOString()}] [PID:${process.pid}] [WorkerProcess] ${message}\n`;

		fs.appendFileSync(path.join(workerRoot, CI_DIAG_FILENAME), line);
	} catch {
		// Diagnostics must never break production code.
	}
}

// Support both ESM and CJS.
const currentDir = typeof __dirname === 'string' ? __dirname : import.meta.dirname;

const getWorkerEntryPath = (): string => {
	const bundledPath = path.join(currentDir, 'worker-entry.js');

	if (fs.existsSync(bundledPath)) {
		return bundledPath;
	}

	const distPath = path.resolve(currentDir, '../../../../../dist/worker-entry.js');

	if (fs.existsSync(distPath)) {
		return distPath;
	}

	throw new Error(
		'Unable to locate the Stylelint worker entry file. Run "node --run build-bundle" before executing integration tests.',
	);
};

let resolvedWorkerEntryPath: string | undefined;

const getResolvedWorkerEntryPath = (): string => {
	if (!resolvedWorkerEntryPath) {
		resolvedWorkerEntryPath = getWorkerEntryPath();
	}

	return resolvedWorkerEntryPath;
};

export const defaultWorkerIdleTimeoutMs = 2 * 60 * 1000; // 2 minutes

type PnPConfiguration = {
	registerPath?: string;
	loaderPath?: string;
};

const createRequestId = (() => {
	let counter = 0;

	return () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;
})();

export class StylelintNotFoundError extends Error {
	readonly code = stylelintNotFoundError;

	constructor(message?: string) {
		super(message ?? 'Stylelint could not be resolved for the requested workspace.');
		this.name = 'StylelintNotFoundError';
	}
}

type WorkerCrashErrorOptions = {
	workerRoot: string;
	code?: number | null;
	signal?: NodeJS.Signals | null;
	kind: 'exit' | 'error';
	originalError?: Error;
};

export class StylelintWorkerCrashedError extends Error {
	readonly workerRoot: string;
	readonly code?: number | null;
	readonly signal?: NodeJS.Signals | null;
	readonly kind: 'exit' | 'error';
	readonly originalError?: Error;

	constructor(message: string, options: WorkerCrashErrorOptions) {
		super(message);
		this.name = 'StylelintWorkerCrashedError';
		this.workerRoot = options.workerRoot;
		this.code = options.code ?? undefined;
		this.signal = options.signal ?? undefined;
		this.kind = options.kind;
		this.originalError = options.originalError;
	}
}

type WorkerUnavailableErrorOptions = {
	workspaceFolder: string;
	packageRoot: string;
	retryInMs: number;
	notifyUser: boolean;
	lastCrashError?: StylelintWorkerCrashedError;
};

export class StylelintWorkerUnavailableError extends Error {
	readonly workspaceFolder: string;
	readonly packageRoot: string;
	readonly retryInMs: number;
	readonly notifyUser: boolean;
	readonly lastCrashError?: StylelintWorkerCrashedError;

	constructor(options: WorkerUnavailableErrorOptions) {
		const seconds = Math.max(1, Math.ceil(options.retryInMs / 1000));

		super(
			`Stylelint worker for "${options.packageRoot}" crashed repeatedly. ` +
				`Will retry automatically in about ${seconds}s or when workspace activity occurs.`,
		);
		this.name = 'StylelintWorkerUnavailableError';
		this.workspaceFolder = options.workspaceFolder;
		this.packageRoot = options.packageRoot;
		this.retryInMs = options.retryInMs;
		this.notifyUser = options.notifyUser;
		this.lastCrashError = options.lastCrashError;
	}
}

type WorkerSuccessResponse = Extract<WorkerResponse, { success: true }>;
type PendingRequest = {
	resolve: (value: WorkerSuccessResponse['result']) => void;
	reject: (error: Error) => void;
};

export class StylelintWorkerProcess {
	#workerRoot: string;
	#logger?: winston.Logger;
	#idleTimeout: number;
	#child?: ChildProcess;
	#pending = new Map<string, PendingRequest>();
	#idleTimer?: NodeJS.Timeout;
	#disposed = false;
	#pnpConfig?: PnPConfiguration;

	constructor(
		workerRoot: string,
		logger?: winston.Logger,
		idleTimeout: number = defaultWorkerIdleTimeoutMs,
		pnpConfig?: PnPConfiguration,
	) {
		this.#workerRoot = workerRoot;
		this.#logger = logger;
		this.#idleTimeout = idleTimeout;
		this.#pnpConfig = pnpConfig;
	}

	/**
	 * Indicates whether the worker process has been disposed.
	 */
	isDisposed(): boolean {
		return this.#disposed;
	}

	async lint(payload: WorkerLintPayload): Promise<WorkerLintResult> {
		const result = (await this.#sendRequest('lint', payload)) as WorkerLintResult;

		return result;
	}

	async resolve(payload: WorkerResolvePayload): Promise<WorkerResolveResult> {
		const result = (await this.#sendRequest('resolve', payload)) as WorkerResolveResult;

		return result;
	}

	async resolveConfig(payload: WorkerResolveConfigPayload): Promise<WorkerResolveConfigResult> {
		const result = (await this.#sendRequest('resolveConfig', payload)) as WorkerResolveConfigResult;

		return result;
	}

	dispose(): void {
		if (this.#disposed) {
			return;
		}

		this.#disposed = true;

		ciDiagLog(
			this.#workerRoot,
			`dispose(): childPid=${this.#child?.pid ?? 'null'}, pendingCount=${this.#pending.size}`,
		);

		for (const [, pending] of this.#pending) {
			pending.reject(new Error('Stylelint worker disposed.'));
		}

		this.#pending.clear();

		if (this.#idleTimer) {
			clearTimeout(this.#idleTimer);
			this.#idleTimer = undefined;
		}

		if (this.#child) {
			this.#child.removeAllListeners();

			try {
				this.#child.kill();
			} catch {
				// ignore
			}

			this.#child = undefined;
		}
	}

	async #sendRequest(
		type: WorkerRequest['type'],
		payload?: WorkerLintPayload | WorkerResolvePayload,
	): Promise<WorkerSuccessResponse['result']> {
		this.#ensureChild();

		const id = createRequestId();

		return await new Promise<WorkerSuccessResponse['result']>((resolve, reject) => {
			if (!this.#child) {
				ciDiagLog(
					this.#workerRoot,
					`#sendRequest FAIL: child null after #ensureChild, id=${id}, type=${type}`,
				);
				reject(new Error('Worker process is not available.'));

				return;
			}

			this.#pending.set(id, {
				resolve: (value) => {
					this.#pending.delete(id);
					this.#resetIdleTimer();
					resolve(value);
				},
				reject: (error) => {
					this.#pending.delete(id);
					reject(error);
				},
			});

			const request: WorkerRequest = {
				id,
				type,

				payload: (payload ?? {}) as WorkerLintPayload &
					WorkerResolvePayload &
					WorkerResolveConfigPayload,
			};

			const sendOk = this.#child.send(request);

			ciDiagLog(
				this.#workerRoot,
				`#sendRequest: id=${id}, type=${type}, childPid=${this.#child.pid}, send()=${sendOk}, pendingCount=${this.#pending.size}`,
			);
		});
	}

	#ensureChild(): void {
		if (this.#child || this.#disposed) {
			ciDiagLog(
				this.#workerRoot,
				`#ensureChild SKIP: child=${this.#child ? `alive(pid=${this.#child.pid})` : 'null'}, disposed=${this.#disposed}, pending=${this.#pending.size}`,
			);

			return;
		}

		const execArgv = this.#createExecArgv(this.#collectPnPArgs());

		this.#logger?.debug('Starting Stylelint worker process', {
			workerRoot: this.#workerRoot,
			execArgv,
		});

		this.#child = fork(getResolvedWorkerEntryPath(), {
			cwd: this.#workerRoot,
			execArgv,
			stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
			env: {
				...process.env,
				STYLELINT_WORKSPACE: this.#workerRoot,
			},
		});

		ciDiagLog(
			this.#workerRoot,
			`#ensureChild FORKED: newPid=${this.#child.pid}, workerRoot=${this.#workerRoot}`,
		);

		this.#child.on('message', (message: WorkerResponse) => this.#handleMessage(message));
		this.#child.on('exit', (code, signal) => {
			ciDiagLog(
				this.#workerRoot,
				`EXIT event: code=${code}, signal=${signal}, disposed=${this.#disposed}, pendingCount=${this.#pending.size}, pendingIds=[${[...this.#pending.keys()].join(',')}]`,
			);

			const crashError = this.#disposed
				? undefined
				: new StylelintWorkerCrashedError(
						`Stylelint worker for "${this.#workerRoot}" exited unexpectedly (code: ${
							code ?? 'null'
						}, signal: ${signal ?? 'null'}).`,
						{
							workerRoot: this.#workerRoot,
							code,
							signal,
							kind: 'exit',
						},
					);

			if (crashError) {
				this.#logger?.error('Stylelint worker exited unexpectedly', {
					workerRoot: this.#workerRoot,
					code,
					signal,
				});
			}

			this.#child = undefined;

			const rejectionError = crashError ?? new Error('Stylelint worker exited unexpectedly.');

			for (const [id, pending] of this.#pending) {
				ciDiagLog(this.#workerRoot, `EXIT rejecting pending request: id=${id}`);
				pending.reject(rejectionError);
			}

			this.#pending.clear();
		});

		this.#child.on('error', (error) => {
			ciDiagLog(
				this.#workerRoot,
				`ERROR event: message=${error.message}, disposed=${this.#disposed}, pendingCount=${this.#pending.size}`,
			);

			const crashError = new StylelintWorkerCrashedError(
				`Stylelint worker for "${this.#workerRoot}" failed (${error.message ?? 'unknown'})`,
				{
					workerRoot: this.#workerRoot,
					kind: 'error',
					originalError: error,
				},
			);

			this.#logger?.error('Stylelint worker process error', {
				workerRoot: this.#workerRoot,
				error,
			});

			this.#child = undefined;

			for (const [id, pending] of this.#pending) {
				ciDiagLog(this.#workerRoot, `ERROR rejecting pending request: id=${id}`);
				pending.reject(crashError);
			}

			this.#pending.clear();
		});

		this.#resetIdleTimer();
	}

	#handleMessage(message: WorkerResponse): void {
		const pending = this.#pending.get(message.id);

		if (!pending) {
			return;
		}

		if (message.success) {
			pending.resolve(message.result);

			return;
		}

		const error = this.#deserializeError(message.error);

		pending.reject(error);
	}

	#deserializeError(error: SerializedWorkerError): Error {
		if (error.code === stylelintNotFoundError) {
			return new StylelintNotFoundError(error.message);
		}

		const instance = new Error(error.message);

		instance.name = error.name ?? 'Error';
		instance.stack = error.stack;

		return instance;
	}

	#createExecArgv(pnpArgs: string[]): string[] {
		const baseArgs = process.execArgv.filter((arg) => !arg.startsWith('--inspect'));

		return [...baseArgs, ...pnpArgs];
	}

	#collectPnPArgs(): string[] {
		const args: string[] = [];

		if (this.#pnpConfig?.registerPath) {
			args.push('-r', this.#pnpConfig.registerPath);
		}

		if (this.#pnpConfig?.loaderPath) {
			const loaderSpecifier = this.#pnpConfig.loaderPath.startsWith('file://')
				? this.#pnpConfig.loaderPath
				: pathToFileURL(this.#pnpConfig.loaderPath).href;

			args.push('--loader', loaderSpecifier);
		}

		return args;
	}

	#resetIdleTimer(): void {
		if (this.#idleTimer) {
			clearTimeout(this.#idleTimer);
		}

		this.#idleTimer = setTimeout(() => {
			this.#logger?.debug('Disposing idle Stylelint worker', {
				workerRoot: this.#workerRoot,
			});

			this.dispose();
		}, this.#idleTimeout);
	}
}
