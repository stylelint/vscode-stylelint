'use strict';

const path = require('path');

// eslint-disable-next-line node/no-unpublished-require
const { runTests } = require('vscode-test');

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '..');

		// The path to the extension test script
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, '.');

		// Download VS Code, unzip it and run the integration test
		await runTests({ extensionDevelopmentPath, extensionTestsPath });
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('Failed to run tests');
		// eslint-disable-next-line no-process-exit
		process.exit(1);
	}
}

main();
