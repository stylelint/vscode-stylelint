import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import glob from 'fast-glob';

/**
 * Colours the given string in the given colour if using the terminal.
 */
function colour(text: string, shade: 'red' | 'green' | 'yellow'): string {
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
 */
async function fileExists(filePath: string): Promise<boolean> {
	try {
		return (await fs.stat(filePath)).isFile();
	} catch {
		return false;
	}
}

/**
 * Traverses code in `src` directory and ensures that each file has a
 * corresponding unit test file in the `__tests__` directory at the same level.
 */
async function enforceUnitTestsPerFile(): Promise<void> {
	const cwd = path.join(__dirname, '..');

	const srcFiles = await glob('src/**/*.{ts,js}', {
		cwd,
		absolute: true,
		ignore: [
			'src/extension/start-server.ts',
			'**/__tests__',
			'**/__mocks__',
			'**/index.{ts,js}',
			'**/types.{ts,js}',
		],
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

	process.exit(exitCode); // eslint-disable-line n/no-process-exit
}

void enforceUnitTestsPerFile();
