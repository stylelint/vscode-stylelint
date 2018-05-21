# find-pkg-dir

[![npm version](https://img.shields.io/npm/v/find-pkg-dir.svg)](https://www.npmjs.com/package/find-pkg-dir)
[![Build Status](https://travis-ci.com/shinnn/find-pkg-dir.svg?branch=master)](https://travis-ci.com/shinnn/find-pkg-dir)
[![Build status](https://ci.appveyor.com/api/projects/status/gmxyhw7o2n1ndypc/branch/master?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/find-pkg-dir/branch/master)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/find-pkg-dir.svg)](https://coveralls.io/r/shinnn/find-pkg-dir)

Find the root directory of a Node.js project from a given path

```javascript
const findPkgDir = require('find-pkg-dir');

// When the /Users/shinnn/foo directory contains a package.json file:

findPkgDir('/Users/shinnn/foo'); //=> '/Users/shinnn/foo'
findPkgDir('/Users/shinnn/foo/bar'); //=> '/Users/shinnn/foo'
findPkgDir('/Users/shinnn/foo/bar/baz'); //=> '/Users/shinnn/foo'
```

Unlike [the](https://www.npmjs.com/package/pkg-dir) [prior](https://www.npmjs.com/package/find-pkg) [arts](https://www.npmjs.com/package/find-root),

* It uses [`InternalModuleStat`](https://github.com/nodejs/node/blob/v10.1.0/src/node_file.cc#L798) through [`require.resolve()`](https://nodejs.org/api/modules.html#modules_require_resolve_request_options) for [faster]() operation than [`fs.statSync()`](https://nodejs.org/api/fs.html#fs_fs_statsync_path).
* It strictly checks if a path is file or directory, to avoid regarding a `package.json` *directory* as a `package.json` file wrongly.
* It automatically resolves symbolic links.

## Installation

[Use](https://docs.npmjs.com/cli/install) [npm](https://docs.npmjs.com/getting-started/what-is-npm).

```
npm install find-pkg-dir
```

## API

```javascript
const findPkgDir = require('find-pkg-dir');
```

### findPkgDir(*path*)

*path*: `string` (a path to start searching from)  
Return: `string` (absolute path) or `null`

It finds the first directory containing a [`package.json` file](https://docs.npmjs.com/files/package.json), recursively looking up, starting with the given *path*.

When it cannot find any `package.json` files finally, returns `null`.

```javascript
findPkgDir('path/of/non/nodejs/project'); //=> null
```

### Benchmark

```
find-pkg-dir (this project):
Find from the current directory        6.7020186997950075 ms/ops
Find from the deep directory           322.12139540016653 ms/ops
Resolve symlinks                       5.378852599859238 ms/ops
Find from the `package.json` directory 77.20890000015497 ms/ops

find-pkg + path.dirname():
Find from the current directory        9.038500399887562 ms/ops
Find from the deep directory           433.8039125002921 ms/ops
Resolve symlinks                       N/A (operation failed)
Find from the `package.json` directory N/A (operation failed)

find-root:
Find from the current directory        8.830409900099038 ms/ops
Find from the deep directory           522.0375854998827 ms/ops
Resolve symlinks                       N/A (operation failed)
Find from the `package.json` directory N/A (operation failed)

pkg-dir:
Find from the current directory        11.1050084002316 ms/ops
Find from the deep directory           536.8203415997326 ms/ops
Resolve symlinks                       N/A (operation failed)
Find from the `package.json` directory N/A (operation failed)
```

## License

[ISC License](./LICENSE) © 2018 Shinnosuke Watanabe
