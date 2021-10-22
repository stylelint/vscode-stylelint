'use strict';

const fs = require('fs/promises');
const path = require('path');
const process = require('process');
const glob = require('fast-glob');

/**
 * @param {string} text
 * @param {'red' | 'green' | 'yellow'} shade
 * @returns {string}
 */
function colour(text, shade) {
	if (!process.stdout.isTTY) {
		return text;
	}

	switch (shade) {
		case 'red':
			return `\x1b[31m${text}\x1b[0m`;
		case 'green':
			return `\x1b[32m${text}\x1b[0m`;
		case 'yellow':
			return `\x1b[33m${text}\x1b[0m`;
		default:
			return text;
	}
}

const tags = {
	error: colour('[error]', 'red'),
	success: colour('[success]', 'green'),
};

/**
 * Checks if a file exists at the given path.
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
	try {
		return (await fs.stat(filePath)).isFile();
	} catch (err) {
		return false;
	}
}

/**
 * Traverses code in `src` directory and ensures that each file has a
 * corresponding unit test file in the `__tests__` directory at the same level.
 */
async function enforceUnitTestsPerFile() {
	const cwd = path.join(__dirname, '..');

	const srcFiles = await glob('src/*/**/*.js', {
		cwd,
		absolute: true,
		ignore: ['**/__tests__', '**/__mocks__', '**/index.js'],
	});

	let exitCode = 0;

	for (const srcFile of srcFiles) {
		const testDir = path.join(path.dirname(srcFile), '__tests__');

		if (!(await fileExists(path.join(testDir, path.basename(srcFile))))) {
			exitCode = 1;

			const relativePath = path.relative(cwd, srcFile);

			console.error(`${tags.error} No unit test file found for ${colour(relativePath, 'yellow')}`);
		}
	}

	if (exitCode === 0) {
		console.log(`${tags.success} All modules have a corresponding unit test file.`);
	} else {
		console.error(`
Found missing unit test files. Make sure any new modules have a corresponding
unit test file with the same name in the __tests__ directory adjacent to the
module.`);
	}

	process.exit(exitCode);
}

enforceUnitTestsPerFile();
