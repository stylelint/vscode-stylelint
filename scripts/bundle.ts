import path from 'node:path';
import process from 'node:process';
import { rm } from 'node:fs/promises';
import * as esbuild from 'esbuild';
import glob from 'fast-glob';

const rootDir = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));

/**
 * Bundles the extension into a single file per entry point.
 */
async function bundle(): Promise<void> {
	const entryPoints = ['build/extension/index.js', 'build/extension/start-server.js'];

	for (const item of await glob('dist/*', { cwd: rootDir })) {
		await rm(item);
	}

	const options: esbuild.BuildOptions = {
		absWorkingDir: rootDir,
		entryPoints,
		entryNames: '[name]',
		bundle: true,
		outdir: 'dist',
		external: ['vscode'],
		format: 'cjs',
		platform: 'node',
		logLevel: 'info',
		sourcemap: args.has('--sourcemap'),
		minify: args.has('--minify'),
	};

	try {
		if (args.has('--watch')) {
			const context = await esbuild.context(options);

			await context.watch();
		} else {
			await esbuild.build(options);
		}
	} catch (error) {
		console.error(error);
		process.exit(1); // eslint-disable-line n/no-process-exit
	}
}

void bundle();
