import assert from 'node:assert';
import process from 'node:process';

import packageJson from '../package.json' with { type: 'json' };

const nodeVersion = process.version.slice(1); // trim the 'v' from the version

assert.equal(packageJson.volta.node, nodeVersion, 'Invalid "volta.node" in package.json');
