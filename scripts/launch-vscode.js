'use strict';

const path = require('node:path');
const { execSync, spawn } = require('node:child_process');
const process = require('node:process');

const {
	downloadAndUnzipVSCode,
	resolveCliArgsFromVSCodeExecutablePath,
} = require('@vscode/test-electron');

const packageJson = require('../package.json');

const rootDir = path.resolve(__dirname, '..');
const defaultWorkspace = path.resolve(rootDir, 'test/e2e/workspace/workspace.code-workspace');
const minimumVscodeVersion = packageJson.engines?.vscode.match(/^>=(.+)$/)?.[1];
const allowedLogLevels = new Set(['trace', 'debug', 'info', 'warn', 'error', 'critical', 'off']);

if (!minimumVscodeVersion) {
	throw new Error(`Unexpected VS Code engine constraint: ${packageJson.engines?.vscode}`);
}

/**
 * @param {string[]} argv
 */
function parseLaunchArguments(argv) {
	let logLevel = 'debug';
	const passthroughArgs = [];
	let passthroughMode = false;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (passthroughMode) {
			passthroughArgs.push(arg);
			continue;
		}

		if (arg === '--') {
			passthroughMode = true;
			passthroughArgs.push(...argv.slice(index));
			break;
		}

		if (arg === '--log-level') {
			const value = argv[index + 1];

			if (!value) {
				throw new Error('--log-level requires a value');
			}

			logLevel = value;
			index += 1;
			continue;
		}

		if (arg.startsWith('--log-level=')) {
			logLevel = arg.split('=')[1];
			continue;
		}

		passthroughArgs.push(arg);
	}

	logLevel = logLevel.toLowerCase();

	if (!allowedLogLevels.has(logLevel)) {
		throw new Error(
			`Unsupported --log-level "${logLevel}". Valid values: ${Array.from(allowedLogLevels).join(', ')}`,
		);
	}

	return { logLevel, passthroughArgs };
}

/**
 * Builds the extension bundle and launches VS Code via @vscode/test-electron without running tests.
 */
async function launchVSCode() {
	try {
		console.log('Building bundle...');
		execSync('npm run build-bundle', { stdio: 'inherit' });

		console.log(`Ensuring VS Code ${minimumVscodeVersion} is available...`);
		const vscodeExecutablePath = await downloadAndUnzipVSCode(minimumVscodeVersion);
		const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
		const { logLevel, passthroughArgs } = parseLaunchArguments(process.argv.slice(2));
		const defaultArgs = [
			defaultWorkspace,
			`--extensionDevelopmentPath=${rootDir}`,
			'--log',
			logLevel,
			'--extensionLogLevel',
			logLevel,
			'--verbose',
		];

		const launchArgs = [...cliArgs, ...defaultArgs, ...passthroughArgs];

		console.log();
		console.log(
			`> ${packageJson.name}@${packageJson.version} vscode launch (log-level=${logLevel})`,
		);
		console.log(`> ${cli} ${launchArgs.join(' ')}`);
		console.log();

		const env = { ...process.env };

		if (logLevel === 'debug' || logLevel === 'trace') {
			env.NODE_ENV = 'development';
		} else {
			env.NODE_ENV = 'production';
		}

		const vscodeProcess = spawn(cli, launchArgs, {
			shell: process.platform === 'win32',
			stdio: 'inherit',
			env,
		});

		const exitCode = await new Promise((resolve) => {
			vscodeProcess.on('close', resolve);
		});

		return exitCode;
	} catch (error) {
		console.error('Error launching VS Code:', error instanceof Error ? error.message : error);

		return 1;
	}
}

launchVSCode().then((code) => {
	// eslint-disable-next-line n/no-process-exit
	process.exit(code);
});
