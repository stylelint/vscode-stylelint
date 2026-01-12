'use strict';

/** @type {import('@cspell/cspell-types').CSpellUserSettings} */
const config = {
	version: '0.2',
	language: 'en-GB',
	files: ['**/*.js', '**/*.ts', '**/*.json', '**/*.md', '**/*.yml', '**/*.css', '**/*.scss'],
	ignorePaths: ['**/node_modules', '**/.yarn', '**/coverage', 'dist', 'build'],
	words: [
		'Autofix',
		'browserslist',
		'cooldown',
		'Cooldown',
		'caniuse',
		'color',
		'Descriptionless',
		'ENOTDIR',
		'esbuild',
		'Hookable',
		'hookable',
		'outdir',
		'libgconf',
		'Linters',
		'linted',
		'Logform',
		'pngquant',
		'pnpm',
		'quuz',
		'rfdc',
		'sass',
		'shinnn',
		'stylehacks',
		'Stylelint',
		'stylelint',
		'stylelintignore',
		'stylelintrc',
		'sugarss',
		'thibaudcolas',
		'uinteger',
		'vscodeignore',
		'Xerus',
		'Supertypes',
		'Unregistration', // Not a word but is used upstream in the LSP package.
	],
};

module.exports = config;
