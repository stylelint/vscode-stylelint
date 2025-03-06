'use strict';

const assert = require('node:assert');
const process = require('node:process');

const packageJson = require('../package.json');

const nodeVersion = process.version.slice(1); // trim the 'v' from the version

assert.equal(packageJson.volta.node, nodeVersion, 'Invalid "volta.node" in package.json');
