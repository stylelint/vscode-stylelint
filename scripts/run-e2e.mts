import { execSync, spawn } from 'node:child_process';
import process from 'node:process';

import packageJson from '../package.json' with { type: 'json' };

/**
 * Run end-to-end tests for the VS Code extension.
 */
async function runE2ETest(): Promise<number> {
	try {
		// Build bundle.
		// Delete NODE_RUN_SCRIPT_NAME to work around a Windows bug where it
		// isn't updated for recursive node --run calls, causing wireit to
		// misidentify the script.
		// See https://github.com/google/wireit/issues/1168.
		delete process.env.NODE_RUN_SCRIPT_NAME;
		console.log('Building bundle...');
		execSync('node --run build-bundle', { stdio: 'inherit' });

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

		const exitCode: number = await new Promise((resolve) => {
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
