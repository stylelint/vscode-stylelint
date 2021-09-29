'use strict';

/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-process-exit */
/* eslint-disable node/no-unpublished-require */

const fs = require('fs-extra');
const esbuild = require('esbuild');
const glob = require('fast-glob');

const args = new Set(process.argv.slice(2));

async function bundle() {
	const entryPoints = [
		'index.js',
		'server.js',
		// Necessary because bundler cannot recognize lazy loads in
		// https://github.com/stylelint/stylelint/blob/13.13.1/lib/syntaxes/index.js#L9-L15
		...(await glob('node_modules/stylelint/lib/syntaxes/syntax-*.js')),
	];

	for (const path of await glob('dist/*')) {
		await fs.remove(path);
	}

	try {
		await esbuild.build({
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
