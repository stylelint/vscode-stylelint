/* eslint-disable no-var, prefer-template */
'use strict';

var inspect = require('util').inspect;
var ok = require('assert').ok;
var pathLib = require('path');

var basename = pathLib.basename;
var dirname = pathLib.dirname;
var join = pathLib.join;
var parse = pathLib.parse;
var resolve = pathLib.resolve;

var FILENAME = 'package.json';

module.exports = function findPkgDir(dir) {
	if (typeof dir !== 'string') {
		throw new TypeError('Expected a directory path (<string>) to find the Node.js project root directory from it, but got a non-string value ' + inspect(dir) + '.');
	}

	dir = resolve(dir);
	var root = parse(dir).root;

	do {
		try {
			var pkgPath = require.resolve(join(dir, FILENAME));
			ok(basename(pkgPath) === FILENAME);
			return dirname(pkgPath);
		} catch (_) {
			dir = dirname(dir);
		}
	} while (dir !== root);

	return null;
};

/*
'use strict';

const ok = require('assert').ok;
const {dirname, join, parse, resolve} = require('path');

const FILENAME = 'package.json';

module.exports = function findPkgDir(dir) {
	dir = resolve(dir);

	const path = parse(dir);
	const {root} = path;

	do {
		try {
			const pkgPath = require.resolve(join(dir, FILENAME));
			const {base, dir: result} = parse(pkgPath);
			ok(base === FILENAME);
			return result;
		} catch (_) {
			dir = dirname(dir);
		}
	} while (dir !== root);

	return null;
};
*/
