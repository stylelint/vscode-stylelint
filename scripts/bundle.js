'use strict';

const path = require('path');
const fs = require('fs-extra');
const esbuild = require('esbuild');
const glob = require('fast-glob');

const rootDir = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));

async function bundle() {
	const entryPoints = ['src/index.js', 'src/server.js'];

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
	} catch {
		process.exit(1);
	}
}

bundle();
