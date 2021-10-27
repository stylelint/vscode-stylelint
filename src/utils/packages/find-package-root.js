'use strict';

const fs = require('fs/promises');
const path = require('path');

/**
 * Walks up the file tree from the given path until it finds a directory
 * containing a file named `package.json`. Resolves to `undefined` if no such
 * directory is found.
 * @param {string} startPath The path to start from.
 * @param {string} rootFile The file to use to determine when the project root
 * has been reached. Defaults to `package.json`.
 * @returns {Promise<string | undefined>}
 */
async function findPackageRoot(startPath, rootFile = 'package.json') {
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
			if (/** @type {{code?: string}} */ (error).code === 'ENOENT') {
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

module.exports = {
	findPackageRoot,
};
