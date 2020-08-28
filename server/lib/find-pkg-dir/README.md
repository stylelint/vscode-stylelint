# find-pkg-dir

> 🚧 Inlined dependency taken from [https://github.com/shinnn/find-pkg-dir](https://github.com/shinnn/find-pkg-dir).

---

Find the root directory of a Node.js project from a given path

```javascript
const findPkgDir = require("find-pkg-dir");

// When the /Users/shinnn/foo directory contains a package.json file:

findPkgDir("/Users/shinnn/foo"); //=> '/Users/shinnn/foo'
findPkgDir("/Users/shinnn/foo/bar"); //=> '/Users/shinnn/foo'
findPkgDir("/Users/shinnn/foo/bar/baz"); //=> '/Users/shinnn/foo'
```

Unlike [the](https://www.npmjs.com/package/pkg-dir) [prior](https://www.npmjs.com/package/find-pkg) [arts](https://www.npmjs.com/package/find-root),

- It uses [`InternalModuleStat`](https://github.com/nodejs/node/blob/v10.1.0/src/node_file.cc#L798) through [`require.resolve()`](https://nodejs.org/api/modules.html#modules_require_resolve_request_options) as it's [faster](#benchmark) than [`fs.statSync()`](https://nodejs.org/api/fs.html#fs_fs_statsync_path).
- It checks if a path is file or directory, to avoid mistaking a `package.json` _directory_ as a `package.json` file.
- It automatically resolves symbolic links.

## Installation

[Use](https://docs.npmjs.com/cli/install) [npm](https://docs.npmjs.com/about-npm/).

```
npm install find-pkg-dir
```

## API

```javascript
const findPkgDir = require("find-pkg-dir");
```

### findPkgDir(_path_)

_path_: `string` (a path to start searching from)  
Return: `string` (absolute path) or `null`

It finds the first directory containing a [`package.json` file](https://docs.npmjs.com/files/package.json), recursively looking up, starting with the given _path_.

When it cannot find any `package.json` files finally, returns `null`.

```javascript
findPkgDir("path/of/non/nodejs/project"); //=> null
```

### Benchmark

```
find-pkg-dir (this project):
Find from the current directory          6.514971999917179 ms/op avg.
Find from the deep directory           301.970978999976069 ms/op avg.
Resolve symlinks                         4.765490400046110 ms/op avg.
Find from the `package.json` directory  33.653173299971968 ms/op avg.

find-pkg + path.dirname():
Find from the current directory          7.597467000037431 ms/op avg.
Find from the deep directory           421.827792199980479 ms/op avg.
Resolve symlinks                               N/A (operation failed)
Find from the `package.json` directory         N/A (operation failed)

find-root:
Find from the current directory          8.991230100020767 ms/op avg.
Find from the deep directory           479.851285400055360 ms/op avg.
Resolve symlinks                               N/A (operation failed)
Find from the `package.json` directory         N/A (operation failed)

pkg-dir:
Find from the current directory          9.322520200069993 ms/op avg.
Find from the deep directory           505.923578500002634 ms/op avg.
Resolve symlinks                               N/A (operation failed)
Find from the `package.json` directory         N/A (operation failed)
```
