import os from 'os';
import path from 'path';
import type winston from 'winston';
import { runProcessFindLine } from '../processes';
import { PackageManager } from './types';

/**
 * Resolves the global `node_modules` path for different package managers.
 */
export class GlobalPathResolver {
	/**
	 * The logger to use for tracing resolution.
	 */
	#logger: winston.Logger | undefined;

	/**
	 * The cache of resolved paths.
	 */
	#cache: { [key in PackageManager]: string | undefined } = {
		yarn: undefined,
		npm: undefined,
		pnpm: undefined,
	};

	/**
	 * Whether or not the current platform is Windows.
	 */
	#isWindows: boolean;

	/**
	 * The resolvers by package manager.
	 */
	#resolvers: { [key in PackageManager]: () => Promise<string | undefined> } = {
		yarn: this.#yarn.bind(this),
		npm: this.#npm.bind(this),
		pnpm: this.#pnpm.bind(this),
	};

	/**
	 * Instantiates a new global path resolver.
	 * @param logger The logger to use for tracing resolution.
	 */
	constructor(logger?: winston.Logger) {
		this.#logger = logger;
		this.#isWindows = os.platform() === 'win32';
	}

	/**
	 * Resolves the global `node_modules` path for Yarn.
	 *
	 * Note: Only Yarn 1.x is supported. Yarn 2.x and higher have removed
	 * support for globally installed packages.
	 */
	async #yarn(): Promise<string | undefined> {
		const tryParseLog = (line: string): { type: string; data: string } | undefined => {
			try {
				return JSON.parse(line) as { type: string; data: string };
			} catch {
				return undefined;
			}
		};

		const yarnGlobalPath = await runProcessFindLine(
			'yarn',
			['global', 'dir', '--json'],
			this.#isWindows ? { shell: true } : undefined,
			(line) => {
				const log = tryParseLog(line);

				if (!log || log.type !== 'log' || !log.data) {
					return undefined;
				}

				const globalPath = path.join(log.data, 'node_modules');

				this.#logger?.debug('Yarn returned global node_modules path.', { path: globalPath });

				return globalPath;
			},
		);

		if (!yarnGlobalPath) {
			this.#logger?.warn('"yarn global dir --json" did not return a path.');

			return undefined;
		}

		return yarnGlobalPath;
	}

	/**
	 * Resolves the global `node_modules` path for npm.
	 */
	async #npm(): Promise<string | undefined> {
		const npmGlobalPath = await runProcessFindLine(
			'npm',
			['config', 'get', 'prefix'],
			this.#isWindows ? { shell: true } : undefined,
			(line) => {
				const trimmed = line.trim();

				if (!trimmed) {
					return undefined;
				}

				const globalPath = this.#isWindows
					? path.join(trimmed, 'node_modules')
					: path.join(trimmed, 'lib/node_modules');

				this.#logger?.debug('npm returned global node_modules path.', { path: globalPath });

				return globalPath;
			},
		);

		if (!npmGlobalPath) {
			this.#logger?.warn('"npm config get prefix" did not return a path.');

			return undefined;
		}

		return npmGlobalPath;
	}

	/**
	 * Resolves the global `node_modules` path for pnpm.
	 */
	async #pnpm(): Promise<string | undefined> {
		const pnpmGlobalPath = await runProcessFindLine(
			'pnpm',
			['root', '-g'],
			this.#isWindows ? { shell: true } : undefined,
			(line) => {
				const trimmed = line.trim();

				if (!trimmed) {
					return undefined;
				}

				this.#logger?.debug('pnpm returned global node_modules path.', { path: trimmed });

				return trimmed;
			},
		);

		if (!pnpmGlobalPath) {
			this.#logger?.warn('"pnpm root -g" did not return a path.');

			return undefined;
		}

		return pnpmGlobalPath;
	}

	/**
	 * Attempts to resolve the global `node_modules` path for the given package
	 * manager.
	 *
	 * On a successful resolution, the method returns a promise that resolves to the
	 * package manager's global `node_modules` path. Paths are cached in the
	 * resolver on the first successful resolution.
	 *
	 * When a path cannot be resolved, the promise resolves to `undefined`.
	 *
	 * @example
	 * ```js
	 * const resolver = getGlobalPathResolver();
	 * const yarnGlobalPath = await resolver.resolve(
	 *   'yarn',
	 *   message => connection && connection.tracer.log(message)
	 * );
	 * ```
	 * @param packageManager The package manager to resolve the path for.
	 */
	async resolve(packageManager: PackageManager): Promise<string | undefined> {
		const cached = this.#cache[packageManager];

		if (cached) {
			return cached;
		}

		const resolver = this.#resolvers[packageManager];

		if (!resolver) {
			this.#logger?.warn('Unsupported package manager.', { packageManager });

			return undefined;
		}

		try {
			const globalPath = await resolver();

			if (globalPath) {
				this.#cache[packageManager] = globalPath;
			}

			return globalPath;
		} catch (error) {
			this.#logger?.warn('Failed to resolve global node_modules path.', { packageManager, error });

			return undefined;
		}
	}
}
