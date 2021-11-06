import fs from 'fs/promises';
import path from 'path';

/**
 * Walks up the file tree from the given path until it finds a directory
 * containing a file named `package.json`. Resolves to `undefined` if no such
 * directory is found.
 * @param startPath The path to start from.
 * @param rootFile The file to use to determine when the project root has been
 * reached. Defaults to `package.json`.
 */
export async function findPackageRoot(
	startPath: string,
	rootFile = 'package.json',
): Promise<string | undefined> {
	let currentDirectory = startPath;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const manifestPath = path.join(currentDirectory, rootFile);

		try {
			const stat = await fs.stat(manifestPath);

			if (stat.isFile()) {
				return currentDirectory;
			}

			const parent = path.dirname(currentDirectory);

			if (!path.relative(parent, currentDirectory)) {
				return undefined;
			}

			currentDirectory = parent;
		} catch (error) {
			if (
				(error as { code?: string }).code === 'ENOENT' ||
				(error as { code?: string }).code === 'ENOTDIR'
			) {
				const parent = path.dirname(currentDirectory);

				if (!path.relative(parent, currentDirectory)) {
					return undefined;
				}

				currentDirectory = parent;
			} else {
				throw error;
			}
		}
	}
}
