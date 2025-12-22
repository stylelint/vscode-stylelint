import fs from 'node:fs/promises';
import path from 'node:path';

import { inject } from '../../../di/index.js';
import { normalizeFsPath } from '../../utils/index.js';
import { FsPromisesModuleToken, PathModuleToken } from '../../tokens.js';
import type { PnPConfiguration } from '../../types.js';
import { PackageRootService } from './package-root.service.js';
import { resolvePnPConfigKey } from './pnp-configuration-cache.service.js';

type FsModule = Pick<typeof fs, 'stat'>;
type PathModule = Pick<typeof path, 'dirname' | 'extname' | 'isAbsolute' | 'join' | 'resolve'>;

type EnvironmentKeyInput = {
	workerRoot: string;
	stylelintPath?: string;
	pnpConfig?: PnPConfiguration;
};

@inject({
	inject: [FsPromisesModuleToken, PathModuleToken, PackageRootService],
})
export class WorkerEnvironmentService {
	readonly #fs: FsModule;
	readonly #path: PathModule;
	readonly #packageRootService: PackageRootService;

	constructor(fsModule: FsModule, pathModule: PathModule, packageRootService: PackageRootService) {
		this.#fs = fsModule;
		this.#path = pathModule;
		this.#packageRootService = packageRootService;
	}

	async createKey(input: EnvironmentKeyInput): Promise<string> {
		const normalizedRoot = this.#normalizePath(input.workerRoot);
		const resolvedStylelintPath = this.#resolveMaybeRelative(input.stylelintPath, normalizedRoot);
		const stylelintManifest = await this.#resolveStylelintManifest(resolvedStylelintPath);

		const [
			packageJson,
			packageLock,
			yarnLock,
			pnpmLock,
			pnpRegister,
			pnpLoader,
			stylelintEntry,
			stylelintPackage,
		] = await Promise.all([
			this.#statStamp(this.#path.join(normalizedRoot, 'package.json')),
			this.#statStamp(this.#path.join(normalizedRoot, 'package-lock.json')),
			this.#statStamp(this.#path.join(normalizedRoot, 'yarn.lock')),
			this.#statStamp(this.#path.join(normalizedRoot, 'pnpm-lock.yaml')),
			input.pnpConfig?.registerPath ? this.#statStamp(input.pnpConfig.registerPath) : undefined,
			input.pnpConfig?.loaderPath ? this.#statStamp(input.pnpConfig.loaderPath) : undefined,
			resolvedStylelintPath ? this.#statStamp(resolvedStylelintPath) : undefined,
			stylelintManifest ? this.#statStamp(stylelintManifest) : undefined,
		]);

		return [
			`root:${normalizedRoot}`,
			`pkg:${packageJson ?? '-'}`,
			`npmLock:${packageLock ?? '-'}`,
			`yarnLock:${yarnLock ?? '-'}`,
			`pnpmLock:${pnpmLock ?? '-'}`,
			`pnp:${resolvePnPConfigKey(input.pnpConfig)}`,
			`pnpRegister:${pnpRegister ?? '-'}`,
			`pnpLoader:${pnpLoader ?? '-'}`,
			`stylelintPath:${resolvedStylelintPath ?? '-'}`,
			`stylelintEntry:${stylelintEntry ?? '-'}`,
			`stylelintPkg:${stylelintPackage ?? '-'}`,
		].join('|');
	}

	async #resolveStylelintManifest(stylelintPath: string | undefined): Promise<string | undefined> {
		if (!stylelintPath) {
			return undefined;
		}

		const startDirectory = this.#guessDirectory(stylelintPath);
		const packageRoot = await this.#packageRootService.find(startDirectory);

		return packageRoot ? this.#path.join(packageRoot, 'package.json') : undefined;
	}

	#guessDirectory(target: string): string {
		const extension = this.#path.extname(target);

		if (extension) {
			return this.#path.dirname(target);
		}

		return target;
	}

	async #statStamp(filePath: string): Promise<string | undefined> {
		try {
			const stats = await this.#fs.stat(filePath);

			if (!stats.isFile()) {
				return undefined;
			}

			return String(Math.trunc(stats.mtimeMs));
		} catch {
			return undefined;
		}
	}

	#resolveMaybeRelative(target: string | undefined, base: string): string | undefined {
		if (!target) {
			return undefined;
		}

		return this.#path.isAbsolute(target) ? target : this.#path.resolve(base, target);
	}

	#normalizePath(value: string): string {
		const absolute = this.#path.isAbsolute(value) ? value : this.#path.resolve(value);

		return normalizeFsPath(absolute) ?? absolute;
	}
}
