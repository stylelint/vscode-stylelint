// @no-unit-test -- This is an entry point that cannot feasibly be unit tested.

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import type stylelint from 'stylelint';

import { GlobalPathResolverService } from '../services/stylelint-runtime/global-path-resolver.service.js';
import { PackageRootService } from '../services/stylelint-runtime/package-root.service.js';
import { ProcessRunnerService } from '../services/stylelint-runtime/process-runner.service.js';
import { loadStylelint } from '../stylelint/load-stylelint.js';
import type {
	LinterResult,
	PackageManager,
	RuleMetadataSnapshot,
	RunnerOptions,
	Stylelint,
} from '../stylelint/types.js';
import {
	stylelintNotFoundError,
	type SerializedWorkerError,
	type WorkerLintPayload,
	type WorkerRequest,
	type WorkerResolvePayload,
	type WorkerResponse,
} from './types.js';
import { createWorkerLoggingService } from './worker-logging.service.js';

const toAbsoluteDir = (dir: string): string =>
	path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
const workspaceRequire = createRequire(path.join(process.cwd(), '__stylelint_worker_index__.js'));
const workerLoggingService = createWorkerLoggingService();

const globalPathResolver = new GlobalPathResolverService(
	os,
	path,
	new ProcessRunnerService(),
	workerLoggingService,
);
const packageRootFinder = new PackageRootService();

type StylelintResolutionTarget = {
	specifier: string;
	entryPath: string;
	requireFn: NodeJS.Require;
	resolvedPath: string;
};

const state: {
	stylelint?: Stylelint;
	entryPath?: string;
	resolvedPath?: string;
	ruleMetadata?: RuleMetadataSnapshot;
	version?: string;
} = {};

const createLinterResultSubset = (linterResult: stylelint.LinterResult): LinterResult => {
	const subset: LinterResult = {
		results: (Array.isArray(linterResult.results) ? linterResult.results : []).map(
			({ warnings, invalidOptionWarnings, ignored }) => ({
				warnings: warnings ?? [],
				invalidOptionWarnings: invalidOptionWarnings ?? [],
				ignored,
			}),
		),
	};

	const report = (linterResult as { report?: unknown }).report;

	if (typeof report === 'string') {
		subset.report = report;
	}

	const code = (linterResult as { code?: unknown }).code;

	if (typeof code === 'string') {
		subset.code = code;
	}

	if (!report && !code) {
		const output = (linterResult as { output?: unknown }).output;

		if (typeof output === 'string') {
			subset.output = output;
		}
	}

	if (linterResult.ruleMetadata) {
		subset.ruleMetadata = linterResult.ruleMetadata;
	}

	return subset;
};

const isPromiseLike = <T>(value: unknown): value is PromiseLike<T> =>
	typeof value === 'object' && value !== null && 'then' in (value as Record<string, unknown>);

type RuleDefinitionMap = Record<
	string,
	{ meta?: stylelint.RuleMeta } | Promise<{ meta?: stylelint.RuleMeta }>
>;

const sendMessage = (message: WorkerResponse): void => {
	if (typeof process.send === 'function') {
		process.send(message);
	}
};

const serializeError = (error: unknown): SerializedWorkerError => {
	if (error instanceof Error) {
		const rawCode = (error as NodeJS.ErrnoException).code;
		const serialized = {
			name: error.name,
			message: error.message,
			stack: error.stack,
			code: typeof rawCode === 'number' ? String(rawCode) : rawCode,
		};

		return serialized;
	}

	return {
		name: 'Error',
		message: typeof error === 'string' ? error : 'Unknown error',
	};
};

const createNotFoundError = (): Error => {
	const error = new Error('Stylelint could not be resolved from the current workspace.');

	(error as NodeJS.ErrnoException).code = stylelintNotFoundError;

	return error;
};

/**
 * Creates a snapshot of the rule metadata from the provided Stylelint module.
 */
async function snapshotRuleMetadata(
	stylelintModule: Stylelint,
): Promise<RuleMetadataSnapshot | undefined> {
	const rulesSource = stylelintModule.rules as
		| RuleDefinitionMap
		| (() => RuleDefinitionMap | Promise<RuleDefinitionMap>)
		| Promise<RuleDefinitionMap>
		| undefined;

	if (!rulesSource) {
		return undefined;
	}

	let resolvedRules: RuleDefinitionMap | undefined;

	if (typeof rulesSource === 'function') {
		resolvedRules = await rulesSource();
	} else if (isPromiseLike<RuleDefinitionMap>(rulesSource)) {
		resolvedRules = await rulesSource;
	} else {
		resolvedRules = rulesSource;
	}

	if (!resolvedRules || typeof resolvedRules !== 'object') {
		return undefined;
	}

	const metadata: RuleMetadataSnapshot = {};

	for (const [name, ruleOrPromise] of Object.entries(resolvedRules)) {
		const rulePromise: PromiseLike<{ meta?: stylelint.RuleMeta } | undefined> = isPromiseLike<{
			meta?: stylelint.RuleMeta;
		}>(ruleOrPromise)
			? ruleOrPromise
			: Promise.resolve(ruleOrPromise as { meta?: stylelint.RuleMeta } | undefined);
		const rule = await rulePromise;
		const meta = rule?.meta;

		if (meta) {
			metadata[name] = meta;
		}
	}

	return Object.keys(metadata).length ? metadata : undefined;
}

/**
 * Reads the version of the Stylelint package from its package.json.
 */
async function readPackageVersion(packageRoot: string | undefined): Promise<string | undefined> {
	if (!packageRoot) {
		return undefined;
	}

	try {
		const manifestPath = path.join(packageRoot, 'package.json');
		const rawManifest = await fs.readFile(manifestPath, 'utf8');
		const manifest = JSON.parse(rawManifest) as { version?: string };

		return manifest.version;
	} catch {
		return undefined;
	}
}

/**
 * Attempts to resolve Stylelint from the global modules path for the specified package manager.
 */
async function resolveFromGlobal(
	packageManager: PackageManager | undefined,
	resolver: (dir: string) => Promise<StylelintResolutionTarget | undefined>,
): Promise<StylelintResolutionTarget | undefined> {
	if (!packageManager) {
		return undefined;
	}

	const globalModulesPath = await globalPathResolver.resolve(packageManager);

	if (!globalModulesPath) {
		return undefined;
	}

	return await resolver(globalModulesPath);
}

/**
 * Determines how the worker should resolve the Stylelint module for linting requests.
 * @param stylelintPath Optional explicit path provided by the caller.
 * @param codeFilename Optional file currently being linted to guide module resolution.
 */
async function resolveStylelintTarget(
	stylelintPath: string | undefined,
	codeFilename: string | undefined,
	runnerOptions?: RunnerOptions,
): Promise<StylelintResolutionTarget> {
	if (stylelintPath) {
		const normalizedPath = path.isAbsolute(stylelintPath)
			? stylelintPath
			: path.resolve(process.cwd(), stylelintPath);
		const resolvedPath = (await packageRootFinder.find(normalizedPath)) ?? normalizedPath;

		return {
			specifier: normalizedPath,
			entryPath: normalizedPath,
			requireFn: workspaceRequire,
			resolvedPath,
		};
	}

	const candidateDirs = new Set<string>();

	if (codeFilename) {
		candidateDirs.add(path.dirname(codeFilename));
	}

	candidateDirs.add(process.cwd());

	const tryResolveFromDir = async (dir: string): Promise<StylelintResolutionTarget | undefined> => {
		const baseDir = toAbsoluteDir(dir);
		const requireFn = createRequire(path.join(baseDir, '__stylelint_worker_index__.js'));

		try {
			const entryPath = requireFn.resolve('stylelint');
			const resolvedPath = (await packageRootFinder.find(entryPath)) ?? entryPath;

			return {
				specifier: 'stylelint',
				entryPath,
				requireFn,
				resolvedPath,
			};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') {
				throw error;
			}

			return undefined;
		}
	};

	for (const dir of candidateDirs) {
		const resolved = await tryResolveFromDir(dir);

		if (resolved) {
			return resolved;
		}
	}

	const globalResolved = await resolveFromGlobal(runnerOptions?.packageManager, tryResolveFromDir);

	if (globalResolved) {
		return globalResolved;
	}

	throw createNotFoundError();
}

/**
 * Ensures that the Stylelint module is loaded and ready for use.
 */
async function ensureStylelint(
	stylelintPath?: string,
	codeFilename?: string,
	runnerOptions?: RunnerOptions,
): Promise<void> {
	const target = await resolveStylelintTarget(stylelintPath, codeFilename, runnerOptions);

	if (state.stylelint && state.resolvedPath === target.resolvedPath) {
		return;
	}

	try {
		const { stylelint: loaded } = await loadStylelint(
			packageRootFinder,
			target.specifier,
			target.requireFn,
			target.entryPath,
		);

		state.stylelint = loaded;
		state.entryPath = target.entryPath;
		state.resolvedPath = target.resolvedPath;
		state.ruleMetadata = await snapshotRuleMetadata(loaded);
		state.version = await readPackageVersion(target.resolvedPath);
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		const isModuleNotFound = code === 'MODULE_NOT_FOUND' || code === stylelintNotFoundError;

		if (isModuleNotFound) {
			throw createNotFoundError();
		}

		throw error;
	}
}

/**
 * Handles a resolve request from the parent process.
 */
async function handleResolve(
	request: WorkerRequest & { type: 'resolve'; payload: WorkerResolvePayload },
): Promise<void> {
	await ensureStylelint(
		request.payload.stylelintPath,
		request.payload.codeFilename,
		request.payload.runnerOptions,
	);

	if (!state.resolvedPath || !state.entryPath) {
		throw createNotFoundError();
	}

	sendMessage({
		id: request.id,
		success: true,
		result: {
			resolvedPath: state.resolvedPath,
			entryPath: state.entryPath,
			version: state.version,
		},
	});
}

/**
 * Handles a lint request from the parent process.
 */
async function handleLint(
	request: WorkerRequest & { type: 'lint'; payload: WorkerLintPayload },
): Promise<void> {
	await ensureStylelint(
		request.payload.stylelintPath,
		request.payload.options.codeFilename,
		request.payload.runnerOptions,
	);

	if (!state.stylelint || !state.resolvedPath) {
		throw createNotFoundError();
	}

	const linterResult = await state.stylelint.lint(request.payload.options);
	const subsetResult = createLinterResultSubset(linterResult);

	sendMessage({
		id: request.id,
		success: true,
		result: {
			resolvedPath: state.resolvedPath,
			linterResult: subsetResult,
			ruleMetadata: state.ruleMetadata,
		},
	});
}

const handleMessage = async (request?: WorkerRequest): Promise<void> => {
	if (!request) {
		return;
	}

	try {
		switch (request.type) {
			case 'resolve': {
				await handleResolve(
					request as WorkerRequest & { type: 'resolve'; payload: WorkerResolvePayload },
				);
				break;
			}

			case 'lint': {
				await handleLint(request as WorkerRequest & { type: 'lint'; payload: WorkerLintPayload });
				break;
			}

			case 'shutdown': {
				sendMessage({ id: request.id, success: true });
				process.exitCode = 0;

				return;
			}

			default:
				throw new Error(`Unknown worker request type: ${(request as { type: string }).type}`);
		}
	} catch (error) {
		sendMessage({
			id: request.id,
			success: false,
			error: serializeError(error),
		});
	}
};

process.on('message', (request: WorkerRequest) => {
	void handleMessage(request);
});

process.on('disconnect', () => {
	process.exitCode = 0;
});
