'use strict';

/** @type {import('cspell').CSpellSettings} */
const config = {
	version: '0.2',
	language: 'en-GB',
	globRoot: __dirname,
	files: ['**/*.js', '**/*.ts', '**/*.json', '**/*.md', '**/*.yml', '**/*.css', '**/*.scss'],
	ignorePaths: ['**/node_modules', '**/.yarn', '**/coverage', 'dist'],
	words: [
		'browserslist',
		'caniuse',
		'Descriptionless',
		'esbuild',
		'outdir',
		'libgconf',
		'Linters',
		'linted',
		'Logform',
		'pnpm',
		'quuz',
		'shinnn',
		'stylehacks',
		'Stylelint',
		'stylelint',
		'stylelintignore',
		'stylelintrc',
		'sugarss',
		'thibaudcolas',
		'vscodeignore',
		'Xerus',
	],
	overrides: [
		{
			filename: 'package.json',
			// cspell:disable-next-line
			words: ['Autofix'],
		},
	],
};

module.exports = config;
