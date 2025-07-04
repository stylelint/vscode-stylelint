'use strict';

const { execSync, spawn } = require('child_process');
const process = require('process');

const packageJson = require('../package.json');

/**
 * Run end-to-end tests for the VS Code extension.
 */
async function runE2ETest() {
	try {
		// Build bundle.
		console.log('Building bundle...');
		execSync('npm run build-bundle', { stdio: 'inherit' });

		// Run vscode-test with all passed arguments.
		console.log();
		console.log(`> ${packageJson.name}@${packageJson.version} vscode-test`);
		console.log(`> vscode-test ${process.argv.slice(2).join(' ')}`);
		console.log();
		const args = process.argv.slice(2);
		const vscodeTest = spawn('npm', ['exec', 'vscode-test', '--', ...args], {
			shell: process.platform === 'win32',
			stdio: 'inherit',
		});

		const exitCode = await new Promise((resolve) => {
			vscodeTest.on('close', resolve);
		});

		return exitCode;
	} catch (error) {
		console.error('Error during build or test:', error instanceof Error ? error.message : error);

		return 1;
	} finally {
		// Always format the workspace file.
		try {
			console.log('Formatting workspace file...');
			execSync(
				'npm exec prettier -- -w --parser jsonc test/e2e/workspace/workspace.code-workspace',
				{
					stdio: 'inherit',
				},
			);
		} catch (formatError) {
			console.error(
				'Error formatting workspace file:',
				formatError instanceof Error ? formatError.message : formatError,
			);
		}
	}
}

runE2ETest().then((exitCode) => {
	// eslint-disable-next-line n/no-process-exit
	process.exit(exitCode);
});
