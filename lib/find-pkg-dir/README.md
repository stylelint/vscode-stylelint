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

* It uses [`InternalModuleStat`](https://github.com/nodejs/node/blob/v10.1.0/src/node_file.cc#L798) through [`require.resolve()`](https://nodejs.org/api/modules.html#modules_require_resolve_request_options) as it's [faster](#benchmark) than [`fs.statSync()`](https://nodejs.org/api/fs.html#fs_fs_statsync_path).
* It checks if a path is file or directory, to avoid mistaking a `package.json` *directory* as a `package.json` file.
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
Find from the current directory          7.023312300443649 ms/op avg.
Find from the deep directory           312.877874401211727 ms/op avg.
Resolve symlinks                         5.399559700489045 ms/op avg.
Find from the `package.json` directory  72.548829698562628 ms/op avg.

find-pkg + path.dirname():
Find from the current directory          8.823328000307082 ms/op avg.
Find from the deep directory           417.688341200351715 ms/op avg.
Resolve symlinks                               N/A (operation failed)
Find from the `package.json` directory         N/A (operation failed)

find-root:
Find from the current directory          8.690280598402023 ms/op avg.
Find from the deep directory           480.454576599597942 ms/op avg.
Resolve symlinks                               N/A (operation failed)
Find from the `package.json` directory         N/A (operation failed)

pkg-dir:
Find from the current directory          9.664102098345756 ms/op avg.
Find from the deep directory           494.113495999574639 ms/op avg.
Resolve symlinks                               N/A (operation failed)
Find from the `package.json` directory         N/A (operation failed)
```

## License

[ISC License](./LICENSE) © 2018 Shinnosuke Watanabe
