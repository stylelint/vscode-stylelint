import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
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
	error: colour('[error]  ', 'red'),
	warning: colour('[warning]', 'yellow'),
	success: colour('[success]', 'green'),
	blank: '         ',
};

const noUnitTestDirective = '// @no-unit-test';
const testFileSuffix = '.test';

/**
 * Builds the absolute path to the expected unit test file for a module.
 */
function getTestFilePathForModule(moduleFilePath: string): string {
	const dir = path.dirname(moduleFilePath);
	const ext = path.extname(moduleFilePath);
	const baseName = path.basename(moduleFilePath, ext);

	return path.join(dir, '__tests__', `${baseName}${testFileSuffix}${ext}`);
}

/**
 * Derives candidate module file paths that could correspond to a test file.
 */
function getModuleFileCandidatesFromTest(testFilePath: string): string[] {
	const ext = path.extname(testFilePath);
	const testBaseName = path.basename(testFilePath, ext);
	const parentDir = path.dirname(path.dirname(testFilePath));
	const moduleBaseName = testBaseName.endsWith(testFileSuffix)
		? testBaseName.slice(0, -testFileSuffix.length)
		: testBaseName;
	const moduleFile = path.join(parentDir, `${moduleBaseName}${ext}`);

	return [
		moduleFile,
		moduleFile.replace(/\.(?:ts|js)$/u, '.ts'),
		moduleFile.replace(/\.(?:ts|js)$/u, '.js'),
	];
}

interface ModuleInfo {
	hasTest: boolean;
	skipUnitTest: boolean;
	testFilePath: string;
}

const noUnitTestDirectiveCache = new Map<string, boolean>();

/**
 * Determines whether a module is annotated with the no-unit-test directive.
 */
async function hasNoUnitTestDirective(filePath: string): Promise<boolean> {
	if (noUnitTestDirectiveCache.has(filePath)) {
		return noUnitTestDirectiveCache.get(filePath)!;
	}

	let hasDirective = false;

	try {
		const fileHandle = await fs.open(filePath, 'r');
		const fileStream = fileHandle.createReadStream({ encoding: 'utf8' });
		const reader = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity,
		});

		for await (const line of reader) {
			if (line.includes(noUnitTestDirective)) {
				hasDirective = true;
				break;
			}
		}

		fileStream.close();
		await fileHandle.close();
	} catch {
		hasDirective = false;
	}

	noUnitTestDirectiveCache.set(filePath, hasDirective);

	return hasDirective;
}

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
		ignore: ['**/__tests__', '**/index.{ts,js}', '**/types.{ts,js}', '**/__tests__/fixtures/**'],
	});

	const moduleMetadata = new Map<string, ModuleInfo>();
	const handledExtraneousTestFiles = new Set<string>();

	let exitCode = 0;
	let totalMissing = 0;
	let totalExtraneous = 0;

	for (const srcFile of srcFiles) {
		const testFilePath = getTestFilePathForModule(srcFile);
		const [hasTest, skipUnitTest] = await Promise.all([
			fileExists(testFilePath),
			hasNoUnitTestDirective(srcFile),
		]);

		moduleMetadata.set(srcFile, {
			hasTest,
			skipUnitTest,
			testFilePath,
		});

		if (!hasTest && !skipUnitTest) {
			exitCode = 1;

			const relativePath = path.relative(cwd, srcFile);

			console.error(`${tags.error} No unit test file found for ${colour(relativePath, 'yellow')}`);
			totalMissing += 1;
		}
	}

	for (const [modulePath, info] of moduleMetadata.entries()) {
		if (!info.skipUnitTest || !info.hasTest) {
			continue;
		}

		const relativeTestPath = path.relative(cwd, info.testFilePath);
		const relativeModulePath = path.relative(cwd, modulePath);

		console.warn(
			`${tags.warning} ${colour(relativeTestPath, 'yellow')} is extraneous because ${colour(relativeModulePath, 'yellow')} is marked with ${noUnitTestDirective}.`,
		);
		totalExtraneous += 1;
		handledExtraneousTestFiles.add(info.testFilePath);
	}

	// Check for extraneous unit test files without a corresponding module.
	const testFiles = await glob('src/**/__tests__/*.{ts,js}', {
		cwd,
		absolute: true,
	});

	for (const testFile of testFiles) {
		if (handledExtraneousTestFiles.has(testFile)) {
			continue;
		}

		const moduleFileCandidates = getModuleFileCandidatesFromTest(testFile);

		let trackedModuleFound = false;

		for (const candidate of moduleFileCandidates) {
			if (moduleMetadata.has(candidate)) {
				trackedModuleFound = true;
				break;
			}
		}

		if (trackedModuleFound) {
			continue;
		}

		let existingModulePath: string | undefined;

		for (const candidate of moduleFileCandidates) {
			if (await fileExists(candidate)) {
				existingModulePath = candidate;
				break;
			}
		}

		if (existingModulePath) {
			if (await hasNoUnitTestDirective(existingModulePath)) {
				const relativeTestPath = path.relative(cwd, testFile);
				const relativeModulePath = path.relative(cwd, existingModulePath);

				console.warn(
					`${tags.warning} Extraneous unit test file found: ${colour(relativeTestPath, 'yellow')}`,
				);
				console.warn(
					`${tags.blank} File is extraneous since ${colour(relativeModulePath, 'yellow')} is marked with ${noUnitTestDirective}.`,
				);
				console.warn(
					`${tags.blank} Consider removing the unit test file or removing ${noUnitTestDirective}.`,
				);
				totalExtraneous += 1;
				handledExtraneousTestFiles.add(testFile);
			}

			continue;
		}

		const relativeTestPath = path.relative(cwd, testFile);

		console.warn(
			`${tags.warning} Extraneous unit test file found: ${colour(relativeTestPath, 'yellow')}`,
		);
		totalExtraneous += 1;
	}

	if (exitCode === 0) {
		console.log(
			`${tags.success} All modules have a corresponding unit test file and no extraneous unit test files were found.`,
		);
	} else {
		if (totalMissing > 0) {
			console.error(`
Found missing unit test files for ${colour(totalMissing.toString(), 'yellow')} module${totalMissing === 1 ? '' : 's'}.
Make sure any new modules have a corresponding unit test file with the same base name plus a .test suffix in the __tests__ directory adjacent to the module.`);
		}

		if (totalExtraneous > 0) {
			console.warn(`
Found ${colour(totalExtraneous.toString(), 'yellow')} extraneous unit test file${totalExtraneous === 1 ? '' : 's'}.
Delete these tests, add any missing modules, or remove any unnecessary ${noUnitTestDirective} directives.`);
		}
	}

	process.exit(exitCode); // eslint-disable-line n/no-process-exit
}

void enforceUnitTestsPerFile();
