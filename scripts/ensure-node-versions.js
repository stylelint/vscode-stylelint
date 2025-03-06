'use strict';

const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const packageJsonPath = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
const packageJson = JSON.parse(packageJsonPath);

const nodeVersion = process.version.slice(1); // trim the 'v' from the version
const voltaNodeVersion = packageJson.volta.node;

if (nodeVersion !== voltaNodeVersion) {
	process.stderr.write(
		`Error: "volta.node" in package.json must be "${nodeVersion}" but is "${voltaNodeVersion}"\n`,
	);
	process.exit(1); // eslint-disable-line n/no-process-exit
}
