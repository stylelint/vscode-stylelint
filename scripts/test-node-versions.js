'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const packageJsonPath = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
const packageJson = JSON.parse(packageJsonPath);

const nodeVersion = process.version.slice(1); // trim the 'v' from the version

assert.equal(packageJson.volta.node, nodeVersion, `Invalid "volta.node" in package.json`);
