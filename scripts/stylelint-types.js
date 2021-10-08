'use strict';

const https = require('https');
const path = require('path');

const fs = require('fs-extra');

const typesDir = path.join(__dirname, '../types/stylelint');
const typesPath = path.join(typesDir, 'index.d.ts');
const typesVersionPath = path.join(typesDir, 'version');

const lockfile = require('../package-lock.json');

const { version } = lockfile?.dependencies?.stylelint;

if (!version) {
	console.error('Could not find stylelint version in package-lock.json');
	process.exit(1);
}

const args = new Set(process.argv.slice(2));

/**
 * Checks if the Stylelint types file is up to date.
 * @returns {Promise<void>}
 */
const checkTypesVersion = async () => {
	try {
		const downloadedVersion = (await fs.readFile(typesVersionPath, 'utf8'))?.trim();

		if (!downloadedVersion) {
			console.error('Could not read types version. Try running `npm run download-types`.');
			process.exit(1);
		}

		if (downloadedVersion !== version) {
			console.error(
				`Types version mismatch: ${downloadedVersion} !== ${version}. Try running \`npm run download-types\`.`,
			);
			process.exit(1);
		}

		console.log('Stylelint types are up to date.');
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
};

/**
 * Gets the GitHub tag/commit for the given version of Stylelint.
 * @param {string} lockfileVersion The version of stylelint from the package-lock.json file.
 * @returns {string}
 */
const getTypesTagOrCommitHash = (lockfileVersion) => {
	if (lockfileVersion.startsWith('git+')) {
		const match = lockfileVersion.match(/#(.+)$/);

		if (!match || !match[1]) {
			throw new Error(`Could not find commit hash for ${lockfileVersion}`);
		}

		return match[1];
	}

	return lockfileVersion;
};

/**
 * Downloads the stylelint types file for the currently installed version of Stylelint.
 * @returns {Promise<void>}
 */
const downloadTypes = async () => {
	const repoVersion = getTypesTagOrCommitHash(version);
	const typesURL = `https://raw.githubusercontent.com/stylelint/stylelint/${repoVersion}/types/stylelint/index.d.ts`;

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
		console.log(`Downloaded Stylelint types file to ${typesPath}`);
		fs.writeFile(typesVersionPath, `${version}\n`);
	});
};

if (args.has('--download')) {
	downloadTypes();
} else {
	checkTypesVersion();
}
