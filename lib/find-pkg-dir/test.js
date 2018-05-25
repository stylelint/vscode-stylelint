'use strict';

const {dirname, join, parse} = require('path');
const {promisify} = require('util');
const {symlink, writeFile} = require('fs');

const test = require('tape');
const findPkgDir = require('.');
const mkdirp = require('mkdirp');
const rmfr = require('rmfr');

const promisifiedMkdirp = promisify(mkdirp);
const promisifiedSymlink = promisify(symlink);
const promisifiedWriteFile = promisify(writeFile);

test('findPkgDir()', async t => {
	t.equal(
		findPkgDir(require.resolve('eslint/bin/eslint.js')),
		dirname(require.resolve('eslint/package.json')),
		'should find a directory where the closest package.json exists from a given path.'
	);

	const tmp = join(__dirname, 'tmp');

	await rmfr(tmp);
	await promisifiedMkdirp(join(tmp, 'package.json'));
	await Promise.all([
		promisifiedSymlink(process.cwd(), join(tmp, 'symlink')),
		promisifiedWriteFile(join(tmp, 'package.json', 'index.js'), '')
	]);

	t.equal(
		findPkgDir(join(tmp, 'package.json', 'index.js')),
		process.cwd(),
		'should check if `package.json` is actually a directory or not.'
	);

	t.equal(
		findPkgDir(join(tmp, 'symlink')),
		process.cwd(),
		'should resolve symlinks.'
	);

	t.equal(
		findPkgDir(parse(__dirname).root),
		null,
		'should return null when all the ancestor directories doesn\'t have package.json.'
	);

	t.throws(
		() => findPkgDir(1),
		/^TypeError.*Expected a directory path.*, but got a non-string value 1 \(number\)\./,
		'should throw an error when it takes a non-string argument.'
	);

	t.end();
});
