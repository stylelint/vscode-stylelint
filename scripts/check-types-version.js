'use strict';

// Checks that the downloaded types file from the stylelint repo is up to date

const fs = require('fs-extra');
const path = require('path');

const typesDir = path.join(__dirname, '../types/stylelint');
const typesVersionPath = path.join(typesDir, 'version');

const lockfile = require('../package-lock.json');

const { version } = lockfile?.dependencies?.stylelint;

if (!version) {
	console.error('Could not find stylelint version in package-lock.json');
	process.exit(1);
}

const checkTypesVersion = async () => {
	try {
		const typesVersion = (await fs.readFile(typesVersionPath, 'utf8'))?.trim();

		if (!typesVersion) {
			console.error('Could not read types version. Try running `npm run download-types`.');
			process.exit(1);
		}

		if (typesVersion !== version) {
			console.error(
				`Types version mismatch: ${typesVersion} !== ${version}. Try running \`npm run download-types\`.`,
			);
			process.exit(1);
		}

		console.log('Stylelint types are up to date.');
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
};

checkTypesVersion();
