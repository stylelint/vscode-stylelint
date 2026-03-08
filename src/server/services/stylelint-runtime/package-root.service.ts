import fs from 'fs/promises';
import path from 'path';
import { inject } from '../../../di/index.js';
import { FsPromisesModuleToken, PathModuleToken } from '../../tokens.js';

@inject({
	inject: [FsPromisesModuleToken, PathModuleToken],
})
export class PackageRootService {
	readonly #fs: Pick<typeof fs, 'stat' | 'readdir'>;
	readonly #path: Pick<typeof path, 'dirname' | 'join' | 'relative'>;

	constructor(
		fsModule?: Pick<typeof fs, 'stat' | 'readdir'>,
		pathModule?: Pick<typeof path, 'dirname' | 'join' | 'relative'>,
	) {
		this.#fs = fsModule ?? fs;
		this.#path = pathModule ?? path;
	}

	async find(startPath: string, rootFile = 'package.json'): Promise<string | undefined> {
		let currentDirectory = startPath;

		while (true) {
			const manifestPath = this.#path.join(currentDirectory, rootFile);

			try {
				const stat = await this.#fs.stat(manifestPath);

				if (stat.isFile()) {
					return currentDirectory;
				}
			} catch (error) {
				const code = (error as { code?: string }).code;

				if (code !== 'ENOENT' && code !== 'ENOTDIR') {
					throw error;
				}
			}

			const parent = this.#path.dirname(currentDirectory);

			if (!this.#path.relative(parent, currentDirectory)) {
				return undefined;
			}

			currentDirectory = parent;
		}
	}

	async findSubPackages(rootDir: string, rootFile = 'package.json'): Promise<string[]> {
		const results: string[] = [];

		const walk = async (dir: string): Promise<void> => {
			let entries;

			try {
				entries = await this.#fs.readdir(dir, { withFileTypes: true });
			} catch {
				return;
			}

			for (const entry of entries) {
				if (!entry.isDirectory() || entry.name === 'node_modules') {
					continue;
				}

				const childDir = this.#path.join(dir, entry.name);
				const manifestPath = this.#path.join(childDir, rootFile);

				try {
					const stat = await this.#fs.stat(manifestPath);

					if (stat.isFile()) {
						results.push(childDir);
					}
				} catch {
					// No package.json here, keep walking.
				}

				await walk(childDir);
			}
		};

		await walk(rootDir);

		return results;
	}
}
