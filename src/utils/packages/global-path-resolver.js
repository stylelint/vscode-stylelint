'use strict';

const os = require('os');
const path = require('path');
const { runProcessFindLine } = require('../processes');

/** @type {{[key in PackageManager]: (trace?: TracerFn, isWindows?: boolean) => Promise<string | undefined>}} */
const resolvers = {
	/**
	 * Resolves the global `node_modules` path for Yarn.
	 *
	 * Note: Only Yarn 1.x is supported. Yarn 2.x and higher have removed
	 * support for globally installed packages.
	 */
	async yarn(trace, isWindows) {
		const tryTrace = trace ?? (() => undefined);
		/** @param {string} line */
		const tryParseLog = (line) => {
			/** @type {{type: any, data: any}} */
			let log;

			try {
				log = JSON.parse(line);
			} catch {
				return undefined;
			}

			return log;
		};

		const yarnGlobalPath = await runProcessFindLine(
			'yarn',
			['global', 'dir', '--json'],
			isWindows ? { shell: true } : undefined,
			(line) => {
				const log = tryParseLog(line);

				if (!log || log.type !== 'log' || !log.data) {
					return undefined;
				}

				const globalPath = path.join(log.data, 'node_modules');

				tryTrace(`Yarn returned global path: "${globalPath}"`);

				return globalPath;
			},
		);

		if (!yarnGlobalPath) {
			tryTrace('"yarn global dir --json" did not return a path.');

			return undefined;
		}

		return yarnGlobalPath;
	},

	/**
	 * Resolves the global `node_modules` path for npm.
	 */
	async npm(trace, isWindows) {
		const tryTrace = trace ?? (() => undefined);
		const npmGlobalPath = await runProcessFindLine(
			'npm',
			['config', 'get', 'prefix'],
			isWindows ? { shell: true } : undefined,
			(line) => {
				const trimmed = line.trim();

				if (!trimmed) {
					return undefined;
				}

				const globalPath =
					os.platform() === 'win32'
						? path.join(trimmed, 'node_modules')
						: path.join(trimmed, 'lib/node_modules');

				tryTrace(`npm returned global path: "${globalPath}"`);

				return globalPath;
			},
		);

		if (!npmGlobalPath) {
			tryTrace('"npm config get prefix" did not return a path.');

			return undefined;
		}

		return npmGlobalPath;
	},

	/**
	 * Resolves the global `node_modules` path for pnpm.
	 */
	async pnpm(trace, isWindows) {
		const tryTrace = trace ?? (() => undefined);
		const pnpmGlobalPath = await runProcessFindLine(
			'pnpm',
			['root', '-g'],
			isWindows ? { shell: true } : undefined,
			(line) => {
				const trimmed = line.trim();

				if (!trimmed) {
					return undefined;
				}

				tryTrace(`pnpm returned global path: "${trimmed}"`);

				return trimmed;
			},
		);

		if (!pnpmGlobalPath) {
			tryTrace('"pnpm root -g" did not return a path.');

			return undefined;
		}

		return pnpmGlobalPath;
	},
};

/**
 * Returns an object with a `resolve` method that takes as its first parameter
 * a supported package manager (`npm`, `yarn`, or `pnpm`) and as its second an
 * optional tracer function that will be used to trace the resolution process.
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
 * @returns {GlobalPathResolver}
 */
function getGlobalPathResolver() {
	/** @type {GlobalPathResolverCache} */
	const cache = {};

	return {
		async resolve(packageManager, trace) {
			const cached = cache[packageManager];

			if (cached) {
				return cached;
			}

			const tryTrace = trace ?? (() => undefined);
			const resolver = resolvers[packageManager];

			if (!resolver) {
				tryTrace(`Package manager "${packageManager}" is not supported.`);

				return undefined;
			}

			const isWindows = os.platform() === 'win32';
			const globalPath = await resolver(trace, isWindows);

			if (globalPath) {
				cache[packageManager] = globalPath;
			}

			return globalPath;
		},
	};
}

module.exports = {
	getGlobalPathResolver,
};
