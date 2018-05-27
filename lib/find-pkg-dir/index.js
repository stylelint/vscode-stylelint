'use strict';

const {ok} = require('assert');
const {basename, dirname, join, parse, resolve} = require('path');

const inspectWithKind = require('inspect-with-kind');

const FILENAME = 'package.json';

module.exports = function findPkgDir(dir) {
	if (typeof dir !== 'string') {
		throw new TypeError(`Expected a directory path (<string>) to find the Node.js project root directory from it, but got a non-string value ${
			inspectWithKind(dir)
		}.`);
	}

	dir = resolve(dir);
	const {root} = parse(dir);

	do {
		try {
			const pkgPath = require.resolve(join(dir, FILENAME));
			ok(basename(pkgPath) === FILENAME);
			return dirname(pkgPath);
		} catch (_) {
			dir = dirname(dir);
		}
	} while (dir !== root);

	return null;
};
