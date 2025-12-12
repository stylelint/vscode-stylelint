import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { inject } from '../../../di/index.js';
import { normalizeFsPath } from '../../utils/index.js';
import { PnPConfiguration } from '../../types.js';
import { FsPromisesModuleToken, PathModuleToken } from '../../tokens.js';

const pnpRegisterFilenames = ['.pnp.cjs', '.pnp.js'];
const pnpLoaderFilename = '.pnp.loader.mjs';
const pnpConfigFilenames = new Set([...pnpRegisterFilenames, pnpLoaderFilename]);

type FsModule = Pick<typeof fs, 'stat'>;
type PathModule = Pick<typeof path, 'basename' | 'dirname' | 'isAbsolute' | 'join' | 'resolve'>;

export const resolvePnPConfigKey = (config?: PnPConfiguration): string =>
	`${config?.registerPath ?? ''}|${config?.loaderPath ?? ''}`;

@inject({
	inject: [FsPromisesModuleToken, PathModuleToken],
})
export class PnPConfigurationCacheService {
	readonly #fs: FsModule;
	readonly #path: PathModule;
	readonly #cache = new Map<string, PnPConfiguration | null>();

	constructor(fsModule?: FsModule, pathModule?: PathModule) {
		this.#fs = fsModule ?? fs;
		this.#path = pathModule ?? path;
	}

	async findConfiguration(codeFilename?: string): Promise<PnPConfiguration | undefined> {
		if (!codeFilename) {
			return undefined;
		}

		let currentDir = this.#path.dirname(codeFilename);
		const visitedKeys: string[] = [];

		while (true) {
			const cacheKey = this.#normalizeCachePath(currentDir);

			visitedKeys.push(cacheKey);

			const cached = this.#cache.get(cacheKey);

			if (cached !== undefined) {
				if (cached) {
					this.#populateCache(visitedKeys, cached);

					return cached;
				}
			} else {
				const config = await this.#readPnPConfiguration(currentDir);

				if (config) {
					this.#cache.set(cacheKey, config);
					this.#populateCache(visitedKeys, config);

					return config;
				}

				this.#cache.set(cacheKey, null);
			}

			const parent = this.#path.dirname(currentDir);

			if (parent === currentDir) {
				return undefined;
			}

			currentDir = parent;
		}
	}

	invalidateForFile(filePath: string | undefined): void {
		if (!filePath) {
			return;
		}

		const baseName = this.#path.basename(filePath);

		if (!pnpConfigFilenames.has(baseName)) {
			return;
		}

		this.#invalidatePnPConfigCache(this.#path.dirname(filePath));
	}

	clearForWorkspace(workspaceFolder: string): void {
		this.#deleteCacheEntriesWithinPath(workspaceFolder);
	}

	clear(): void {
		this.#cache.clear();
	}

	resolveConfigKey(config?: PnPConfiguration): string {
		return resolvePnPConfigKey(config);
	}

	async #readPnPConfiguration(directory: string): Promise<PnPConfiguration | undefined> {
		for (const filename of pnpRegisterFilenames) {
			const registerPath = await this.#statIfFile(this.#path.join(directory, filename));

			if (registerPath) {
				const loaderPath = await this.#statIfFile(this.#path.join(directory, pnpLoaderFilename));

				return { registerPath, loaderPath };
			}
		}

		return undefined;
	}

	async #statIfFile(filePath: string): Promise<string | undefined> {
		try {
			const stats = await this.#fs.stat(filePath);

			if (stats.isFile()) {
				return filePath;
			}
		} catch {
			// ignore
		}

		return undefined;
	}

	#populateCache(visitedKeys: string[], config: PnPConfiguration): void {
		for (const key of visitedKeys) {
			this.#cache.set(key, config);
		}
	}

	#invalidatePnPConfigCache(directory: string): void {
		const normalizedDir = this.#normalizeCachePath(directory);

		for (const [key, value] of this.#cache.entries()) {
			const matchesKey = this.#isWithinNormalizedPath(normalizedDir, key);
			const matchesConfig = value ? this.#pnpConfigMatchesDirectory(value, normalizedDir) : false;

			if (matchesKey || matchesConfig) {
				this.#cache.delete(key);
			}
		}
	}

	#pnpConfigMatchesDirectory(config: PnPConfiguration, normalizedDir: string): boolean {
		if (config.registerPath) {
			const registerDir = this.#normalizeCachePath(this.#path.dirname(config.registerPath));

			if (this.#isWithinNormalizedPath(normalizedDir, registerDir)) {
				return true;
			}
		}

		if (config.loaderPath) {
			const loaderDir = this.#normalizeCachePath(this.#path.dirname(config.loaderPath));

			if (this.#isWithinNormalizedPath(normalizedDir, loaderDir)) {
				return true;
			}
		}

		return false;
	}

	#deleteCacheEntriesWithinPath(rootPath: string): void {
		const normalizedRoot = this.#normalizeCachePath(rootPath);

		for (const key of this.#cache.keys()) {
			if (this.#isWithinNormalizedPath(normalizedRoot, key)) {
				this.#cache.delete(key);
			}
		}
	}

	#normalizeCachePath(value: string): string {
		const absolute = this.#path.isAbsolute(value) ? value : this.#path.resolve(value);

		return normalizeFsPath(absolute) ?? absolute;
	}

	#isWithinNormalizedPath(normalizedRoot: string, candidateNormalized: string): boolean {
		const comparableRoot =
			process.platform === 'win32' ? normalizedRoot.toLowerCase() : normalizedRoot;
		const comparableCandidate =
			process.platform === 'win32' ? candidateNormalized.toLowerCase() : candidateNormalized;

		if (comparableCandidate === comparableRoot) {
			return true;
		}

		return comparableCandidate.startsWith(`${comparableRoot}${path.sep}`);
	}
}
