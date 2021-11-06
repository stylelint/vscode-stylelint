import path from 'path';
import fs from 'fs-extra';
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
		await fs.remove(item);
	}

	try {
		await esbuild.build({
			absWorkingDir: rootDir,
			entryPoints,
			entryNames: '[name]',
			bundle: true,
			outdir: 'dist',
			external: ['vscode'],
			format: 'cjs',
			platform: 'node',
			logLevel: 'info',
			watch: args.has('--watch'),
			sourcemap: args.has('--sourcemap'),
			minify: args.has('--minify'),
		});
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}

bundle();
