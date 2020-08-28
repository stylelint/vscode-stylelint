'use strict';

const { dirname, join, parse } = require('path');
// Test file – it’s ok for tests to only run on newer versions of Node than what the project supports.
// eslint-disable-next-line node/no-unsupported-features/node-builtins
const { mkdir, symlink, writeFile } = require('fs').promises;

const rmfr = require('rmfr');
const test = require('tape');

const findPkgDir = require('.');

test('findPkgDir()', async (t) => {
	t.equal(
		findPkgDir(require.resolve('eslint/bin/eslint.js')),
		dirname(require.resolve('eslint/package.json')),
		'should find a directory where the closest package.json exists from a given path.',
	);

	const tmp = join(__dirname, 'tmp');

	await rmfr(tmp);
	await mkdir(join(tmp, 'package.json'), { recursive: true });
	await Promise.all([
		symlink(process.cwd(), join(tmp, 'symlink')),
		writeFile(join(tmp, 'package.json', 'index.js'), ''),
	]);

	t.equal(
		findPkgDir(join(tmp, 'package.json', 'index.js')),
		process.cwd(),
		'should check if `package.json` is actually a directory or not.',
	);

	t.equal(findPkgDir(join(tmp, 'symlink')), process.cwd(), 'should resolve symlinks.');

	t.equal(
		findPkgDir(parse(__dirname).root),
		null,
		"should return null when all the ancestor directories doesn't have package.json.",
	);

	t.throws(
		() => findPkgDir(1),
		/^TypeError.*Expected a directory path.*, but got a non-string value 1 \(number\)\./u,
		'should throw an error when it takes a non-string argument.',
	);

	t.end();
});
