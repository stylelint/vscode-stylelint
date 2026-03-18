import path from 'node:path';
import process from 'node:process';

import { inject } from '../../../di/index.js';
import { normalizeFsPath } from '../../utils/index.js';
import { PackageRootService } from './package-root.service.js';

const packageManifestFilename = 'package.json';

@inject({
	inject: [PackageRootService],
})
export class PackageRootCacheService {
	readonly #packageRootFinder: PackageRootService;
	readonly #cache = new Map<string, string | null>();

	constructor(packageRootFinder: PackageRootService) {
		this.#packageRootFinder = packageRootFinder;
	}

	async determineWorkerRoot(
		workspaceFolder: string,
		codeFilename?: string,
		stylelintPath?: string,
	): Promise<string> {
		if (codeFilename) {
			const codeRoot = await this.#getCachedPackageRoot(codeFilename);

			if (codeRoot) {
				return codeRoot;
			}
		}

		if (stylelintPath) {
			const absoluteStylelintPath = path.isAbsolute(stylelintPath)
				? stylelintPath
				: path.join(workspaceFolder, stylelintPath);
			const stylelintRoot = await this.#getCachedPackageRoot(absoluteStylelintPath);

			if (stylelintRoot) {
				return stylelintRoot;
			}
		}

		return workspaceFolder;
	}

	invalidateForFile(filePath: string | undefined): void {
		if (!filePath) {
			return;
		}

		if (path.basename(filePath) !== packageManifestFilename) {
			return;
		}

		this.#invalidatePackageRootCache(path.dirname(filePath));
	}

	clearForWorkspace(workspaceFolder: string): void {
		this.#deleteCacheEntriesWithinPath(workspaceFolder);
	}

	clear(): void {
		this.#cache.clear();
	}

	async #getCachedPackageRoot(startPath: string): Promise<string | undefined> {
		const cacheKey = this.#normalizeCachePath(startPath);
		const cached = this.#cache.get(cacheKey);

		if (cached !== undefined) {
			return cached ?? undefined;
		}

		const result = await this.#packageRootFinder.find(startPath);

		this.#cache.set(cacheKey, result ?? null);

		return result;
	}

	#invalidatePackageRootCache(directory: string): void {
		const normalizedDir = this.#normalizeCachePath(directory);

		for (const [key, value] of this.#cache.entries()) {
			const matchesKey = this.#isWithinNormalizedPath(normalizedDir, key);
			const normalizedValue = value ? this.#normalizeCachePath(value) : undefined;
			const matchesValue =
				normalizedValue !== undefined &&
				this.#isWithinNormalizedPath(normalizedDir, normalizedValue);

			if (matchesKey || matchesValue) {
				this.#cache.delete(key);
			}
		}
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
		const absolute = path.isAbsolute(value) ? value : path.resolve(value);

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
