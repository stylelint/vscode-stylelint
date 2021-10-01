'use strict';

// Downloads the types file from the stylelint repo to the stylelint-types directory.
// Overwrites the existing file if it exists.

const fs = require('fs-extra');
const https = require('https');
const path = require('path');

const typesDir = path.join(__dirname, '../types/stylelint');
const typesPath = path.join(typesDir, 'index.d.ts');
const typesVersionPath = path.join(typesDir, 'version');

const lockfile = require('../package-lock.json');

const { version } = lockfile?.dependencies?.stylelint;

if (!version) {
	console.error('Could not find stylelint version in package-lock.json');
	process.exit(1);
}

const typesURL = `https://raw.githubusercontent.com/stylelint/stylelint/${version}/types/stylelint/index.d.ts`;

const downloadTypes = async () => {
	await fs.ensureDir(typesDir);

	const typesFile = fs.createWriteStream(typesPath);

	const typesRequest = https.get(typesURL, (response) => {
		if (response.statusCode !== 200) {
			console.error(`Request failed with status code ${response.statusCode}`);
			process.exit(1);
		}

		response.pipe(typesFile);
	});

	typesRequest.on('error', (error) => {
		console.error(error);
		process.exit(1);
	});

	typesRequest.on('close', () => {
		console.log(`Downloaded types file from stylelint to ${typesPath}`);
		fs.writeFile(typesVersionPath, `${version}\n`);
	});
};

downloadTypes();
