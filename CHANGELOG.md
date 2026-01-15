# Changelog

## Unreleased

- Fixed: formatting with Stylelint 14 and 15 when using custom syntaxes ([#813](https://github.com/stylelint/vscode-stylelint/pull/813)).

## 2.0.1 - 2026-01-13

- Fixed: "RangeError: Maximum call stack size exceeded" error ([#810](https://github.com/stylelint/vscode-stylelint/pull/810)).

## 2.0.0 - 2026-01-12

This release changes the extension's architecture to support Stylelint 17.

- Removed: support for VS Code less than 1.103.0 ([#762](https://github.com/stylelint/vscode-stylelint/pull/762)).
- Added: support for Stylelint 17 ([#762](https://github.com/stylelint/vscode-stylelint/pull/762)).
- Added: support for Stylelint installed with Yarn PnP in ESM projects ([#762](https://github.com/stylelint/vscode-stylelint/pull/762)).
- Added: `logLevel` extension setting ([#764](https://github.com/stylelint/vscode-stylelint/pull/764)).
- Fixed: `.stylelintignore` not being respected ([#775](https://github.com/stylelint/vscode-stylelint/pull/775)).

## 1.6.0 - 2025-11-27

Since this version, the extension has followed [Stylelint's changelog format](https://stylelint.io/changelog/), which means no more category headings like "Added" or "Fixed" have been used.
Instead, each change is prefixed with such categories like "Added: feature X" or "Fixed: bug Y" etc.

- Added: `stylelint.rules.customizations` setting to override rule severity levels ([#696](https://github.com/stylelint/vscode-stylelint/pull/696)).
- Added: error diagnostics for rule-less configurations ([#699](https://github.com/stylelint/vscode-stylelint/pull/699)).

## [1.5.3](https://github.com/stylelint/vscode-stylelint/compare/v1.5.2...v1.5.3) (2025-06-05)

No actual changes.

## [1.5.2](https://github.com/stylelint/vscode-stylelint/compare/v1.5.1...v1.5.2) (2025-06-05)

No actual changes.

## [1.5.1](https://github.com/stylelint/vscode-stylelint/compare/v1.5.0...v1.5.1) (2025-06-05)

### Fixed

- Return Fix All actions as well as Quick Fix ([#650](https://github.com/stylelint/vscode-stylelint/pull/650)).
- Watch config file changes with `.mjs` and `.cjs` extensions ([#672](https://github.com/stylelint/vscode-stylelint/pull/672)).

## [1.5.0](https://github.com/stylelint/vscode-stylelint/compare/v1.4.0...v1.5.0) (2025-03-28)

### Added

- Add support for quick fixes ([#635](https://github.com/stylelint/vscode-stylelint/pull/635)).

### Changed

- Bump oldest supported vscode to 1.83.0 ([#645](https://github.com/stylelint/vscode-stylelint/pull/645)).

## [1.4.0](https://github.com/stylelint/vscode-stylelint/compare/v1.3.0...v1.4.0) (2024-03-28)

### Changed

- Bump vscode language server dependencies ([#521](https://github.com/stylelint/vscode-stylelint/pull/521)).

### Fixed

- Remove inconsistent `"less"` from defaults of `stylelint.validate` and `stylelint.snippet` ([#454](https://github.com/stylelint/vscode-stylelint/pull/454)).

## [1.3.0](https://github.com/stylelint/vscode-stylelint/compare/v1.2.4...v1.3.0) (2023-11-02)

### Added

- Language server can now be restarted with the "Restart Stylelint Server" command ([#339](https://github.com/stylelint/vscode-stylelint/pull/339)).
- The warning shown for unsupported versions of Stylelint will now be shown in any workspace with a locally installed copy of Stylelint, regardless of the file type of the open file ([#340](https://github.com/stylelint/vscode-stylelint/pull/340)).
- Language server can now be disposed with `server.dispose()` and is disposed when receiving the shutdown LSP notification ([#326](https://github.com/stylelint/vscode-stylelint/pull/326)).
- Add support for range warnings ([#358](https://github.com/stylelint/vscode-stylelint/pull/358)).

### Changed

- A custom notification used for testing in VS Code sent by the language server now uses the `stylelint` namespace instead of `textDocument` ([3b845a2](https://github.com/stylelint/vscode-stylelint/commit/3b845a2)).

### Fixed

- Files are now re-linted when a Stylelint configuration file is changed in the workspace ([#356](https://github.com/stylelint/vscode-stylelint/pull/356)).

## [1.2.4](https://github.com/stylelint/vscode-stylelint/compare/v1.2.3...v1.2.4) (2023-02-14)

### Added

- Add "stylelint.reportDescriptionlessDisables" option ([#442](https://github.com/stylelint/vscode-stylelint/pull/442)).

## [1.2.3](https://github.com/stylelint/vscode-stylelint/compare/v1.2.2...v1.2.3) (2022-08-16)

### Fixed

- Fix: don't pass invalid "false" rule value when formatting ([#399](https://github.com/stylelint/vscode-stylelint/pull/399)).
- Fix to resolve doc URL of plugin rules when using stylelint v14.10 ([#416](https://github.com/stylelint/vscode-stylelint/pull/416))

## [1.2.2](https://github.com/stylelint/vscode-stylelint/compare/v1.2.1...v1.2.2) (2022-02-09)

### Fixed

- Fix rule doc URL ([#375](https://github.com/stylelint/vscode-stylelint/pull/375)).

## [1.2.1](https://github.com/stylelint/vscode-stylelint/compare/v1.2.0...v1.2.1) (2021-11-18)

### Fixed

- Fixed a bug where code actions would not work on save ([#330](https://github.com/stylelint/vscode-stylelint/pull/330)).

## [1.2.0](https://github.com/stylelint/vscode-stylelint/compare/v1.1.0...v1.2.0) (2021-11-16)

### Added

- Code actions are now provided for disabling rules and showing documentation ([#322](https://github.com/stylelint/vscode-stylelint/pull/322)).
- Resource-level configuration is now supported, allowing you to differently configure the extension in different workspaces ([#318](https://github.com/stylelint/vscode-stylelint/pull/318)).
- If the language client fails to connect to the server, the extension will now display an error message ([#322](https://github.com/stylelint/vscode-stylelint/pull/322)).

### Changed

- Warning text and readme updated to clarify that older versions of Stylelint may continue to work with this extension, but are no longer supported ([40a2ce7](https://github.com/stylelint/vscode-stylelint/commit/40a2ce7)).
- Extension description updated to clarify that this is the official Stylelint extension ([#305](https://github.com/stylelint/vscode-stylelint/pull/305)).

### Fixed

- When extension configuration is edited, the extension no longer needs to be reloaded to use the updated settings ([#322](https://github.com/stylelint/vscode-stylelint/pull/322)).
- Worked around VS Code behaviour that resulted in problems having a hover region only one pixel wide ([#325](https://github.com/stylelint/vscode-stylelint/pull/325)).

## [1.1.0](https://github.com/stylelint/vscode-stylelint/compare/v1.0.3...v1.1.0) (2021-11-06)

### Added

- If Stylelint is installed in a workspace using [Yarn](https://yarnpkg.com/) with [Plug-n-Play](https://yarnpkg.com/features/pnp), it can now be resolved without the need for Yarn's [editor SDKs](https://yarnpkg.com/getting-started/editor-sdks). ([#273](https://github.com/stylelint/vscode-stylelint/pull/273)).
- Errors encountered during Stylelint resolution from `node_modules` are now reported in the output window. ([#302](https://github.com/stylelint/vscode-stylelint/pull/302)).

### Changed

- The JSON schema URL now uses HTTPS. ([1a225ca](https://github.com/stylelint/vscode-stylelint/commit/1a225ca)).

### Fixed

- Logs with errors no longer are missing information such as `error.message` or `error.stack` ([#310](https://github.com/stylelint/vscode-stylelint/pull/310)).
- Stylelint resolution no longer fails when running the configured package manager results in an error ([#314](https://github.com/stylelint/vscode-stylelint/pull/314)).

## [1.0.3](https://github.com/stylelint/vscode-stylelint/compare/v1.0.2...v1.0.3) (2021-10-27)

### Fixed

- Fixed a bug where Stylelint resolution would fail due to an `ENOTDIR` error ([#285](https://github.com/stylelint/vscode-stylelint/pull/285)).

### Changed

<!--cspell:disable-next-line -->

- The extension no longer blocks VS Code's startup. Thanks to [@robole](https://github.com/robole) for the idea. ([#257](https://github.com/stylelint/vscode-stylelint/pull/257))

## [1.0.2](https://github.com/stylelint/vscode-stylelint/compare/v1.0.1...v1.0.2) (2021-10-26)

### Fixed

- [Less](https://lesscss.org/) is no longer linted by default. It was added as a default due to an oversight in the previous release. Only documents with language identifiers `css` and `postcss` will be linted by default. ([#280](https://github.com/stylelint/vscode-stylelint/pull/280))

## [1.0.1](https://github.com/stylelint/vscode-stylelint/compare/v1.0.0...v1.0.1) (2021-10-22)

### Fixed

- ~~[Less](https://lesscss.org/) is now correctly linted by default ([#270](https://github.com/stylelint/vscode-stylelint/pull/270)).~~

## [1.0.0](https://github.com/stylelint/vscode-stylelint/compare/v0.87.6...v1.0.0) (2021-10-21)

### Breaking Changes

- Dropped support for Stylelint 13 and prior; only Stylelint 14 is supported now. See the [migration guide](README.md#%EF%B8%8F-stylelint-13x-and-prior-is-no-longer-supported) for more details.
- Removed bundled copy of Stylelint; local or global installation is now required. See the [migration guide](README.md#%EF%B8%8F-stylelint-is-no-longer-bundled) for more details.
- Validation and completion now only works for documents with language identifiers `css` and `postcss` by default. See the [migration guide](README.md#%EF%B8%8F-only-css-and-postcss-are-validated-by-default) for more details.
- `stylelint.syntax` configuration option removed; use `stylelint.customSyntax` instead. See the [migration guide](README.md#%EF%B8%8F-only-css-and-postcss-are-validated-by-default) for more details.

### Added

- Opening a workspace with a version of Stylelint older than v14.0.0 will now show a warning message once with a link to the [migration guide](https://github.com/stylelint/vscode-stylelint#migrating-from-vscode-stylelint-0xstylelint-13x).

### Changed

- Updated [vscode-languageserver](https://github.com/Microsoft/vscode-languageserver-node) to v7, conforming to LSP v3.16.0.
- Extension re-architected to be more modular and easier to test ([#265](https://github.com/stylelint/vscode-stylelint/pull/265)).

## [0.87.6](https://github.com/stylelint/vscode-stylelint/compare/v0.87.5...v0.87.6) (2021-10-04)

### Fixed

- Fixed bug where two duplicate document formatters would be shown for documents in supported languages ([#251](https://github.com/stylelint/vscode-stylelint/pull/251)).

## [0.87.5](https://github.com/stylelint/vscode-stylelint/compare/v0.87.4...v0.87.5) (2021-09-30)

### Fixed

- Fixed bug where extension would throw an error "Cannot find module '.../dist/template-parse'" ([#244](https://github.com/stylelint/vscode-stylelint/pull/244)).

## [0.87.4](https://github.com/stylelint/vscode-stylelint/compare/v0.87.3...v0.87.4) (2021-09-29)

### Fixed

- Fixed bug where extension would throw an error "Cannot find module 'postcss-html/extract'" ([#240](https://github.com/stylelint/vscode-stylelint/pull/240)).

## [0.87.3](https://github.com/stylelint/vscode-stylelint/compare/v0.87.2...v0.87.3) (2021-09-28)

### Fixed

- Fixed bug where extension would throw an error "Cannot find module './syntax-...'" ([#238](https://github.com/stylelint/vscode-stylelint/pull/238)).

## [0.87.2](https://github.com/stylelint/vscode-stylelint/compare/v0.87.1...v0.87.2) (2021-09-28)

### Changed

- Extension is now bundled to reduce size and improve startup time (>7mb → ~500-600kb) ([#236](https://github.com/stylelint/vscode-stylelint/pull/236)).

## [0.87.1](https://github.com/stylelint/vscode-stylelint/compare/v0.87.0...v0.87.1) (2021-09-28)

### Fixed

- Fixed entry in .vscodeignore resulting in package missing dependencies ([e9813e6](https://github.com/stylelint/vscode-stylelint/commit/e9813e6)).

## [0.87.0](https://github.com/stylelint/vscode-stylelint/compare/v0.86.0...v0.87.0) (2021-09-28)

### Added

- Document formatting support ([#200](https://github.com/stylelint/vscode-stylelint/pull/200)).

### Changed

- Bundled Stylelint updated to v13.13.1 ([#235](https://github.com/stylelint/vscode-stylelint/pull/235)).
- Internal testing setup refactored, switched to [Jest](https://jestjs.io/) using [jest-runner-vscode](https://github.com/adalinesimonian/jest-runner-vscode) ([#224](https://github.com/stylelint/vscode-stylelint/pull/224)).
- Readme updated for readability ([#232](https://github.com/stylelint/vscode-stylelint/pull/232), [c211b1a](https://github.com/stylelint/vscode-stylelint/commit/c211b1a), [0bbea15](https://github.com/stylelint/vscode-stylelint/commit/0bbea15)).

## [0.86.0](https://github.com/stylelint/vscode-stylelint/compare/v0.85.0...v0.86.0) (2021-02-07)

- Add "stylelint.configFile" option ([#168](https://github.com/stylelint/vscode-stylelint/pull/168))

## [0.85.0](https://github.com/stylelint/vscode-stylelint/compare/v0.84.0...v0.85.0) (2020-08-12)

- [f6f3672](https://github.com/stylelint/vscode-stylelint/commit/f6f367214fbfd4ad6568abecead0bed76cabda75) Add "stylelint.syntax" option
- [ec802e8](https://github.com/stylelint/vscode-stylelint/commit/ec802e8b42247d0f2e6c654062bfa16de10ecd96) Add "stylelint.ignoreDisables" option
- [9a0c69d](https://github.com/stylelint/vscode-stylelint/commit/9a0c69d9d6981d49295277388f0b23bd152a1777) Add "stylelint.configBasedir" option
- [115118b](https://github.com/stylelint/vscode-stylelint/commit/115118ba1a9d2f36bfc0d7e9cbcc8370e227a6d1) Replace snippets with completions
- [f204d8d](https://github.com/stylelint/vscode-stylelint/commit/f204d8d524a72c48de2e5ad98960d683d50202d5) Add "stylelint.reportInvalidScopeDisables" option
- [192feb5](https://github.com/stylelint/vscode-stylelint/commit/192feb525c9120072f9c021d11d5a23c7311b69c) Add types to JSDoc
- [83d7555](https://github.com/stylelint/vscode-stylelint/commit/83d755558702f0b6867cc76961290ef294686539) Add code action to show link to rule documentation

## [0.84.0](https://github.com/stylelint/vscode-stylelint/compare/v0.83.0...v0.84.0) (2020-03-18)

- [e777f4c ](https://github.com/stylelint/vscode-stylelint/commit/e777f4c93089e764fd6a95efbcab9736b5be361c) Add "stylelint.validate" option

## [0.83.0](https://github.com/stylelint/vscode-stylelint/compare/v0.82.0...v0.83.0) (2020-02-20)

- [f7a2fcd](https://github.com/stylelint/vscode-stylelint/commit/f7a2fcdaf7958b1ea0595f9c91eb9a38079a9198) Add "stylelint.reportNeedlessDisables" option
- [34388c0](https://github.com/stylelint/vscode-stylelint/pull/53/commits/34388c05b25397ec5a34bd751da4fc3742c57594) Add "stylelint.stylelintPath" option for Yarn 2 compatibility
- [6eb4473](https://github.com/stylelint/vscode-stylelint/pull/69/commits/6eb4473b10dc4f9dae7fb6a98345d469eb23a34a) Fix auto-fix when there are errors that cannot be auto-fixed
- [4b62566](https://github.com/stylelint/vscode-stylelint/pull/71/commits/4b6256659c0c074660cce82accf6dc1d10076788) Fix missing `snippets` folder from extension package
- [b71f453](https://github.com/stylelint/vscode-stylelint/commit/b71f4535d1e801576b463513e27a24f0a0c784df) Add snippets support for Less files

## [0.82.0](https://github.com/stylelint/vscode-stylelint/compare/v0.81.0...v0.82.0) (2020-02-14)

- [77b66c1](https://github.com/stylelint/vscode-stylelint/commit/77b66c13cf5dea3286d0df56bbff1486ed9bc747) Update stylelint from v12.0.0 to v13.2.0

## [0.81.0](https://github.com/stylelint/vscode-stylelint/compare/v0.80.0...v0.81.0) (2020-02-03)

- [0fd9975](https://github.com/stylelint/vscode-stylelint/commit/0fd9975d9b74cbe83674b64a0e2f2c59453ea0a7) Added `stylelint-disable` snippets
- [5f01e54](https://github.com/stylelint/vscode-stylelint/commit/5f01e5471720303e68ece4b7a778ff1283d27db1) Fixes an auto-fix issue where content was removed on save

## [0.80.0](https://github.com/stylelint/vscode-stylelint/compare/v0.71.0...v0.80.0) (2020-01-05)

- [73c78e6](https://github.com/stylelint/vscode-stylelint/commit/73c78e6ee749cc6cae6e82a8bff3d5bb672f39c7) Changed to load stylelint from local node modules
- [8f822e8](https://github.com/stylelint/vscode-stylelint/commit/8f822e840b3b284b333c4b49e16331a3ed199b4e) Rename VS Code setting option from `stylelint configuration options` `stylelint`

## [0.71.0](https://github.com/stylelint/vscode-stylelint/compare/v0.70.0...v0.71.0) (2020-01-04)

- [1a07e95](https://github.com/stylelint/vscode-stylelint/commit/1a07e95ea3d3616f026786589fd1299b79f3fa84) Fixes an auto-fix issue where a missing config would cause unintended changes on save

## [0.70.0](https://github.com/stylelint/vscode-stylelint/compare/v0.60.0...v0.70.0) (2019-12-28)

- [9d55b07](https://github.com/stylelint/vscode-stylelint/commit/9d55b07aa98fee34d9b80ed322aacd5f24621272) Add support for auto-fix
- [e5307d9](https://github.com/stylelint/vscode-stylelint/commit/e5307d9b362cd43c0ac34fbff109b95129188039) Update stylelint from v10.0.1 to v12.0.0

---

## Published release of `stylelint.vscode-stylelint`

### [0.60.0](https://github.com/stylelint/vscode-stylelint/compare/v0.51.0...v0.60.0) (2019-12-23)

- Update all project metadata for new extension repository & publisher

---

## Published release of `thibaudcolas.stylelint`

### [0.51.0](https://github.com/thibaudcolas/vscode-stylelint/compare/shinnn.stylelint-0.51.0...thibaudcolas.stylelint-0.51.0) (2019-11-29)

- [9a85a44](https://github.com/stylelint/vscode-stylelint/commit/9a85a44) Update all project metadata for new extension repository & publisher

---

## Unpublished releases of `shinnn.stylelint`

### [0.51.0](https://github.com/stylelint/vscode-stylelint/tree/v0.51.0) (2019-06-10)

- [fe6a243](https://github.com/stylelint/vscode-stylelint/commit/fe6a243) update dependencies and devDependencies. Highlight: stylelint v10.0.1 -> v10.1.0 https://github.com/stylelint/stylelint/releases/tag/10.1.0

### [0.50.0](https://github.com/stylelint/vscode-stylelint/tree/v0.50.0) (2019-06-10)

- [7ee879d](https://github.com/stylelint/vscode-stylelint/commit/7ee879d) add support for `vue-postcss` language (#272)

### [0.49.0](https://github.com/stylelint/vscode-stylelint/tree/v0.49.0) (2019-04-20)

- [5129fda](https://github.com/stylelint/vscode-stylelint/commit/5129fda) update dependencies and devDependencies. Highlight: update stylelint from v9.10.1 to v10.0.1

### [0.48.1](https://github.com/stylelint/vscode-stylelint/tree/v0.48.1) (2019-04-20)

- [42ff71a](https://github.com/stylelint/vscode-stylelint/commit/42ff71a) test on macOS Mojave https://blog.travis-ci.com/2019-02-12-xcode-10-2-beta-2-is-now-available
- [3e0f07c](https://github.com/stylelint/vscode-stylelint/commit/3e0f07c) stop using File.uriToFilePath() in favour of its successor [vscode-uri](https://github.com/Microsoft/vscode-languageserver-node/commit/8291f55041ea023c4acefa73d8f25f5384aa6426#diff-09d95316ed411f4fa4015c4888d3a43dR12)
- [3e0f07c](https://github.com/stylelint/vscode-stylelint/commit/3e0f07c) Use the `vscode-uri` npm module which provides a more complete implementation of handling VS Code URIs. close https://github.com/shinnn/vscode-stylelint/pull/267
- [2be1633](https://github.com/stylelint/vscode-stylelint/commit/2be1633) stop installing libgconf-2.so.4

### [0.48.0](https://github.com/stylelint/vscode-stylelint/tree/v0.48.0) (2019-01-27)

- [70cedb6](https://github.com/stylelint/vscode-stylelint/commit/70cedb6) update dependencies and devDependencies. Highlight: update stylelint from v9.9.0 to v9.10.1
- [6c0f4ae](https://github.com/stylelint/vscode-stylelint/commit/6c0f4ae) use `if` field to simplify Travis CI branch exclusion

### [0.47.0](https://github.com/stylelint/vscode-stylelint/tree/v0.47.0) (2018-11-28)

- [163ea3a](https://github.com/stylelint/vscode-stylelint/commit/163ea3a) update dependencies. Highlight: stylelint v9.8.0 -> v9.9.0

### [0.46.2](https://github.com/stylelint/vscode-stylelint/tree/v0.46.2) (2018-11-28)

- [9d6f557](https://github.com/stylelint/vscode-stylelint/commit/9d6f557) update dependencies
- [2b89b20](https://github.com/stylelint/vscode-stylelint/commit/2b89b20) wait until this extension activates for a test CSS document

### [0.46.1](https://github.com/stylelint/vscode-stylelint/tree/v0.46.1) (2018-11-13)

- [eb07cd7](https://github.com/stylelint/vscode-stylelint/commit/eb07cd7) add `diagnosticCollectionName` to diagnostics (#251)

### [0.46.0](https://github.com/stylelint/vscode-stylelint/tree/v0.46.0) (2018-11-10)

- [a340659](https://github.com/stylelint/vscode-stylelint/commit/a340659) update dependencies and devDependencies. Highlight: stylelint v9.7.1 -> v9.8.0 https://github.com/stylelint/stylelint/releases/tag/9.8.0
- [4ee5454](https://github.com/stylelint/vscode-stylelint/commit/4ee5454) test on Ubuntu 16.04.5 LTS (Xenial Xerus) http://releases.ubuntu.com/16.04/
- [2c1e5f9](https://github.com/stylelint/vscode-stylelint/commit/2c1e5f9) test on macOS where Xcode 10.1 is installed. https://docs.travis-ci.com/user/reference/osx/#xcode-101

### [0.45.1](https://github.com/stylelint/vscode-stylelint/tree/v0.45.1) (2018-11-06)

- [32af958](https://github.com/stylelint/vscode-stylelint/commit/32af958) update dependencies

### [0.45.0](https://github.com/stylelint/vscode-stylelint/tree/v0.45.0) (2018-10-29)

- [7392183](https://github.com/stylelint/vscode-stylelint/commit/7392183) update dependencies and devDependencies. Highlight: stylelint v9.6.0 -> v9.7.0 https://github.com/stylelint/stylelint/releases/tag/9.7.0

### [0.44.0](https://github.com/stylelint/vscode-stylelint/tree/v0.44.0) (2018-10-13)

- [9494222](https://github.com/stylelint/vscode-stylelint/commit/9494222) update dependencies and devDependencies. highlight: update stylelint from v9.5.0 to v9.6.0 https://github.com/stylelint/stylelint/releases/tag/9.6.0

### [0.43.0](https://github.com/stylelint/vscode-stylelint/tree/v0.43.0) (2018-09-08)

- [4cb1def](https://github.com/stylelint/vscode-stylelint/commit/4cb1def) update dependencies and devDependencies
- [587b6b8](https://github.com/stylelint/vscode-stylelint/commit/587b6b8) add Svelte language activate event (#243)

### [0.42.0](https://github.com/stylelint/vscode-stylelint/tree/v0.42.0) (2018-08-27)

- [16b228b](https://github.com/stylelint/vscode-stylelint/commit/16b228b) add syntax highlighting for .stylelintignore (#240)

### [0.41.0](https://github.com/stylelint/vscode-stylelint/tree/v0.41.0) (2018-08-23)

- [0111121](https://github.com/stylelint/vscode-stylelint/commit/0111121) add a workaround to get .stylelintignore working

### [0.40.0](https://github.com/stylelint/vscode-stylelint/tree/v0.40.0) (2018-08-20)

- [8aca23b](https://github.com/stylelint/vscode-stylelint/commit/8aca23b) update dependencies and devDependencies. Highlight: update stylelint from v9.4.0 to v9.5.0 https://github.com/stylelint/stylelint/releases/tag/9.5.0

### [0.39.0](https://github.com/stylelint/vscode-stylelint/tree/v0.39.0) (2018-08-16)

- [5f29585](https://github.com/stylelint/vscode-stylelint/commit/5f29585) update dependencies and devDependencies
- [5f29585](https://github.com/stylelint/vscode-stylelint/commit/5f29585) update VS Code Language Server and Client from v4 to v5 `[BREAKING]` drop support for VS Code < 1.26.0

### [0.38.1](https://github.com/stylelint/vscode-stylelint/tree/v0.38.1) (2018-07-26)

- [c3f0521](https://github.com/stylelint/vscode-stylelint/commit/c3f0521) add [XSL](https://www.w3.org/Style/XSL/) support (#214)

### [0.38.0](https://github.com/stylelint/vscode-stylelint/tree/v0.38.0) (2018-07-26)

- [87da39e](https://github.com/stylelint/vscode-stylelint/commit/87da39e) update Xcode from v9.3 to v9.4
- [005812a](https://github.com/stylelint/vscode-stylelint/commit/005812a) update dependencies and devDependencies

### [0.37.0](https://github.com/stylelint/vscode-stylelint/tree/v0.37.0) (2018-06-19)

- [cae3bbb](https://github.com/stylelint/vscode-stylelint/commit/cae3bbb) update dependencies. update stylelint to v6.3.0. move more logic to stylelint-vscode

### [0.36.3](https://github.com/stylelint/vscode-stylelint/tree/v0.36.3) (2018-05-26)

- [51e591a](https://github.com/stylelint/vscode-stylelint/commit/51e591a) update dependencies

### [0.36.2](https://github.com/stylelint/vscode-stylelint/tree/v0.36.2) (2018-05-22)

- [ee04041](https://github.com/stylelint/vscode-stylelint/commit/ee04041) update Xcode from v9.3b to v9.3
- [8813af1](https://github.com/stylelint/vscode-stylelint/commit/8813af1) update stylelint-vscode https://github.com/shinnn/stylelint-vscode/compare/v7.0.0-2...v7.0.0-3

### [0.36.1](https://github.com/stylelint/vscode-stylelint/tree/v0.36.1) (2018-05-21)

- [9561e78](https://github.com/stylelint/vscode-stylelint/commit/9561e78) update dependencies and devDependencies
- [e8b4220](https://github.com/stylelint/vscode-stylelint/commit/e8b4220) restricting language services to local files (#172). to adapt to Live Share feature https://github.com/shinnn/vscode-stylelint/pull/172
    <!-- cspell:disable-next-line -->
- [169759f](https://github.com/stylelint/vscode-stylelint/commit/169759f) correct spelling: "editting" → "editing" (#163)

### [0.36.0](https://github.com/stylelint/vscode-stylelint/tree/v0.36.0) (2018-04-02)

- [5350b4b](https://github.com/stylelint/vscode-stylelint/commit/5350b4b) update dependencies and devDependencies. Highlight: stylelint v9.1.3 → v9.2.0
- [ec16094](https://github.com/ƒ/vscode-stylelint/commit/ec16094) remove no longer needed `additionalDocumentSelectors` option. ref. https://github.com/shinnn/vscode-stylelint/pull/82#issuecomment-375176688

### [0.35.0](https://github.com/stylelint/vscode-stylelint/tree/v0.35.0) (2018-03-20)

- [9a144b2](https://github.com/stylelint/vscode-stylelint/commit/9a144b2) run stylelint for JS files when a CSS-in-JS processor is enabled. Those languages IDs are safely supported by stylelint-vscode: https://github.com/shinnn/stylelint-vscode/commit/5e3f4556d74c1fe49f465fe7e17ae373f36a65ef

### [0.34.3](https://github.com/stylelint/vscode-stylelint/tree/v0.34.3) (2018-03-20)

- [44f0e32](https://github.com/stylelint/vscode-stylelint/commit/44f0e32) update devDependencies
- [a0fbbde](https://github.com/stylelint/vscode-stylelint/commit/a0fbbde) allow styled-components processor to be installed a deep folder (#157). If node_modules is in a subdirectory then stylelint is not activated for styled components processor. This glob pattern should handle it properly.

### [v0.34.2](https://github.com/stylelint/vscode-stylelint/tree/v0.34.2) (2018-03-15)

- [f278cc7](https://github.com/stylelint/vscode-stylelint/commit/f278cc7) update stylelint from v9.1.2 to [v9.1.3](https://github.com/stylelint/stylelint/releases/tag/9.1.3)

### [v0.34.1](https://github.com/stylelint/vscode-stylelint/tree/v0.34.1) (2018-03-14)

- [2e4b5f5](https://github.com/stylelint/vscode-stylelint/commit/2e4b5f5) update dependencies

### [v0.34.0](https://github.com/stylelint/vscode-stylelint/tree/v0.34.0) (2018-03-06)

- [b36a0e9](https://github.com/stylelint/vscode-stylelint/commit/b36a0e9) update dependencies and devDependencies. Highlight: update language server and client from v3 to v4 https://github.com/Microsoft/vscode-languageserver-node/tree/v4.0.0#400-server-and-client
- [2edce01](https://github.com/stylelint/vscode-stylelint/commit/2edce01) use whitelisting approach instead of blacklisting. for more simplicity and maintainability
- [454ce9b](https://github.com/stylelint/vscode-stylelint/commit/454ce9b) add a file extension to the license file. because vsce automatically adds it after all. https://github.com/Microsoft/vscode-vsce/commit/4f8cc5470756503f698619ba869bee15dae5abdc
- [ad39322](https://github.com/stylelint/vscode-stylelint/commit/ad39322) include devDependencies to the lockfile. because vsce >= v1.1.0 automatically excludes devDependencies from the published extension, thanks to this great improvement https://github.com/Microsoft/vscode-vsce/commit/1e1887da98f33982f04b2d6bcd92f2e80ab96676 (pull request: https://github.com/Microsoft/vscode-vsce/pull/58)
- [8aaa26b](https://github.com/stylelint/vscode-stylelint/commit/8aaa26b) switch from MIT license to [ISC license](https://opensource.org/licenses/ISC)
- [e7bf9cd](https://github.com/stylelint/vscode-stylelint/commit/e7bf9cd) state `css.validate: false` is not a required setting. It’s highly recommended, though. Note: PNG is compressed by: pngquant --speed=1 --strip
- [9f1fed4](https://github.com/stylelint/vscode-stylelint/commit/9f1fed4) describe how to install "this" extension correctly. because currently there are lots of extension named `stylelint` in Marketplace
- [d02d35a](https://github.com/stylelint/vscode-stylelint/commit/d02d35a) clarify which languages are supported by default
- [c554d7a](https://github.com/stylelint/vscode-stylelint/commit/c554d7a) support HTML/Markdown/Sass/Vue.js/XML by default (#129)
- [f7e6e01](https://github.com/stylelint/vscode-stylelint/commit/f7e6e01) load the default supported languages from package.json
- [6ccacc7](https://github.com/stylelint/vscode-stylelint/commit/6ccacc7) update dependencies
- [f470e38](https://github.com/stylelint/vscode-stylelint/commit/f470e38) add an initial integration test. It at least prevents this extension from being entirely corrupted.
- [a70d674](https://github.com/stylelint/vscode-stylelint/commit/a70d674) use async/await as the latest stable VSCode supports it

### [v0.33.0](https://github.com/stylelint/vscode-stylelint/tree/v0.33.0) (2018-02-22)

- [a947170](https://github.com/stylelint/vscode-stylelint/commit/a947170) update dependencies
- [dc6171b](https://github.com/stylelint/vscode-stylelint/commit/dc6171b) replace non-SSL URLs with the SSL ones as much as possible (#133)
- [60a2ed4](https://github.com/stylelint/vscode-stylelint/commit/60a2ed4) watch config files with explicit extensions, fix https://github.com/shinnn/vscode-stylelint/issues/125

### [v0.32.0](https://github.com/stylelint/vscode-stylelint/tree/v0.32.0) (2018-01-16)

- [76f8bb1](https://github.com/stylelint/vscode-stylelint/commit/76f8bb1) update dependencies and devDependencies

### [v0.31.0](https://github.com/stylelint/vscode-stylelint/tree/v0.31.0) (2017-11-28)

- [1692210](https://github.com/stylelint/vscode-stylelint/commit/1692210) update dependencies

### [v0.30.0](https://github.com/stylelint/vscode-stylelint/tree/v0.30.0) (2017-10-12)

- [7d4f1a6](https://github.com/stylelint/vscode-stylelint/commit/7d4f1a6) update dependencies https://github.com/stylelint/stylelint/releases/tag/8.2.0

### [v0.29.1](https://github.com/stylelint/vscode-stylelint/tree/v0.29.1) (2017-09-19)

- [796b4a6](https://github.com/stylelint/vscode-stylelint/commit/796b4a6) support `sugarss` language ID to integrate with vscode-postcss-language https://github.com/MhMadHamster/vscode-postcss-language
- [3139add](https://github.com/stylelint/vscode-stylelint/commit/3139add) update VSCode language server and client

### [v0.29.0](https://github.com/stylelint/vscode-stylelint/tree/v0.29.0) (2017-09-06)

- [f4e66d6](https://github.com/stylelint/vscode-stylelint/commit/f4e66d6) set the Q&A link in the Marketplace to the [StackOverflow search result](https://stackoverflow.com/questions/tagged/vscode+stylelint)
- [6928ef9](https://github.com/stylelint/vscode-stylelint/commit/6928ef9) update stylelint from v8.0.0 to [v8.1.1](https://github.com/stylelint/stylelint/releases/tag/8.1.1)
- [a7fa0a3](https://github.com/stylelint/vscode-stylelint/commit/a7fa0a3) remove white border around icon (#90)

### [v0.28.0](https://github.com/stylelint/vscode-stylelint/tree/v0.28.0) (2017-07-21)

- [ba710ee](https://github.com/stylelint/vscode-stylelint/commit/ba710ee) update dependencies due to https://github.com/Microsoft/vscode-vsce/commit/e0dff61012b5d2bb8c088b9c799bd4ad0e68dcec
- [3c18f04](https://github.com/stylelint/vscode-stylelint/commit/3c18f04) add PNG icon for Marketplace, due to https://github.com/Microsoft/vscode-vsce/commit/e0dff61012b5d2bb8c088b9c799bd4ad0e68dcec
- [c6b68c3](https://github.com/stylelint/vscode-stylelint/commit/c6b68c3) update stylelint-vscode from [v5 to v6](https://github.com/shinnn/stylelint-vscode/compare/v5.2.3...v6.0.0)

### [v0.27.0](https://github.com/stylelint/vscode-stylelint/tree/v0.27.0) (2017-07-12)

- [27ac10d](https://github.com/stylelint/vscode-stylelint/commit/27ac10d) update dependencies, https://github.com/stylelint/stylelint/releases/tag/7.13.0

### [0.26.0](https://github.com/stylelint/vscode-stylelint/tree/v0.26.0) (2017-06-29)

- [dbc476f](https://github.com/stylelint/vscode-stylelint/commit/dbc476f) remove unstable david-dm.org badges
- [9f50466](https://github.com/stylelint/vscode-stylelint/commit/9f50466) Add support for customizing the document types (#82)

### [v0.25.0](https://github.com/stylelint/vscode-stylelint/tree/v0.25.0) (2017-06-20)

- [f55ed20](https://github.com/stylelint/vscode-stylelint/commit/f55ed20) update dependencies
- [3d27934](https://github.com/stylelint/vscode-stylelint/commit/3d27934) update required `vscode` engine version

### [v0.24.2](https://github.com/stylelint/vscode-stylelint/tree/v0.24.2) (2017-06-08)

- [2142698](https://github.com/stylelint/vscode-stylelint/commit/2142698) update caniuse-db and remove-trailing-separator

### [0.24.1](https://github.com/stylelint/vscode-stylelint/tree/v0.24.1) (2017-06-08)

- [9c155c0](https://github.com/stylelint/vscode-stylelint/commit/9c155c0) regenerate npm-shrinkwrap.json with npm 5

### [v0.24.0](https://github.com/stylelint/vscode-stylelint/tree/v0.24.0) (2017-04-10)

- [a08e79c](https://github.com/stylelint/vscode-stylelint/commit/a08e79c) update dependencies, https://github.com/stylelint/stylelint/releases/tag/7.10.1
- [0c68985](https://github.com/stylelint/vscode-stylelint/commit/0c68985) mention SCSS linting in README (#62)

### [v0.23.0](https://github.com/stylelint/vscode-stylelint/tree/v0.23.0) (2017-02-20)

- [8ddea17](https://github.com/stylelint/vscode-stylelint/commit/8ddea17) update dependencies. Highlight: stylelint v7.8.0 → [v7.9.0](https://github.com/stylelint/stylelint/releases/tag/7.9.0)
- [290e418](https://github.com/stylelint/vscode-stylelint/commit/290e418) apply fed94ee to other properties for more stability

### [v0.22.0](https://github.com/stylelint/vscode-stylelint/tree/v0.22.0) (2017-02-03)

- [be340a9](https://github.com/stylelint/vscode-stylelint/commit/be340a9) update dependencies, https://github.com/stylelint/stylelint/releases/tag/7.8.0, major update of vscode-languageserver-node https://github.com/Microsoft/vscode-languageserver-node/tree/release/3.0.3#303-client-server-and-json-rpc
- [2f3a30a](https://github.com/stylelint/vscode-stylelint/commit/2f3a30a) update dependencies

### [v0.21.2](https://github.com/stylelint/vscode-stylelint/tree/v0.21.2) (2017-01-03)

- [465a704](https://github.com/stylelint/vscode-stylelint/commit/465a704) update stylelint from v7.7.0 to [v7.7.1](https://github.com/stylelint/stylelint/compare/7.7.0...7.7.1)

### [v0.21.1](https://github.com/stylelint/vscode-stylelint/tree/v0.21.1) (2016-12-26)

- [33a6a45](https://github.com/stylelint/vscode-stylelint/commit/33a6a45) update dependencies
- [32fade2](https://github.com/stylelint/vscode-stylelint/commit/32fade2) rename the entry point to the commonly used one in Node.js projects. Different from the Node.js normal package.json spec, VSCode extension's `main` entry point doesn't default to `index.js`. if you remove `main` from package.json, VSCode shows the following error: "properties `activationEvents` and `main` must both be specified or must both be omitted" So, I need to set `main` explicitly.

### [v0.21.0](https://github.com/stylelint/vscode-stylelint/tree/v0.21.0) (2016-12-19)

- [1b52f68](https://github.com/stylelint/vscode-stylelint/commit/1b52f68) update stylelint from v7.6.0 to [v7.7.0](https://github.com/stylelint/stylelint/releases/tag/7.7.0)

### [v0.20.4](https://github.com/stylelint/vscode-stylelint/tree/v0.20.4) (2016-12-05)

- [2c15c83](https://github.com/stylelint/vscode-stylelint/commit/2c15c83) update dependencies

### [v0.20.3](https://github.com/stylelint/vscode-stylelint/tree/v0.20.3) (2016-11-30)

- [2eeb98f](https://github.com/stylelint/vscode-stylelint/commit/2eeb98f) update dependencies

### [v0.20.2](https://github.com/stylelint/vscode-stylelint/tree/v0.20.2) (2016-11-25)

- [b425b01](https://github.com/stylelint/vscode-stylelint/commit/b425b01) update stylelint-vscode from v5.2.0 to v5.2.1 https://github.com/shinnn/stylelint-vscode/commit/a34895433f0da44ab7e67a455c396d93d021ee40 this change should improve performance of this extension.

### [v0.20.1](https://github.com/stylelint/vscode-stylelint/tree/v0.20.1) (2016-11-23)

- [aa00ceb](https://github.com/stylelint/vscode-stylelint/commit/aa00ceb) update dependencies. Highlight: https://github.com/shinnn/stylelint-vscode/commit/44b9fd635cdabc380787a8e2c09633ccf36732eb
- [fed94ee](https://github.com/stylelint/vscode-stylelint/commit/fed94ee) ignore falsy `config` and `configOverrides` entirely. Reason for this change: stylelint v7.6.0 regards `config: null` as an equivalent of `config: {}`, which means passing `config: null` disables all settings derived from .stylelintrc files. This breaking change affects all vscode-stylelint users because `stylelint.config` of the extension defaults to `null`. https://github.com/shinnn/vscode-stylelint/blob/a35e7a42c4c170a569d96ad410da2a04a520fab0/package.json#L51 (fix https://github.com/shinnn/vscode-stylelint/issues/42)

### [v0.20.0](https://github.com/stylelint/vscode-stylelint/tree/v0.20.0) (2016-11-22)

- [f5c1e96](https://github.com/stylelint/vscode-stylelint/commit/f5c1e96) upgrade to stylelint [v7.6.0](https://github.com/stylelint/stylelint/compare/7.5.0...7.6.0)

### [0.19.0](https://github.com/stylelint/vscode-stylelint/tree/v0.19.0) (2016-11-15)

- [f481487](https://github.com/stylelint/vscode-stylelint/commit/f481487) remove automatic update of `configBasedir` option thanks to this commit: https://github.com/stylelint/stylelint/commit/c1e989453bcfdccc0aabb25f76e981952175b27f
- [a0799de](https://github.com/stylelint/vscode-stylelint/commit/a0799de) detect the most suitable syntax from `languageId`. Instead of file extensions. ref. TextDocument API: https://code.visualstudio.com/Docs/extensionAPI/vscode-api#_a-nametextdocumentaspan-classcodeitem-id37textdocumentspan
- [d707fdd](https://github.com/stylelint/vscode-stylelint/commit/d707fdd) support `postcss` language mode. `postcss` language mode is supported by https://marketplace.visualstudio.com/items?itemName=ricard.PostCSS. fix https://github.com/shinnn/vscode-stylelint/issues/24, close https://github.com/shinnn/vscode-stylelint/pull/13
- [a5fa5b5](https://github.com/stylelint/vscode-stylelint/commit/a5fa5b5) show the latest build status on README
- [b601c53](https://github.com/stylelint/vscode-stylelint/commit/b601c53) Add onDidClose handler (#32) fix #29
- [07df9ea](https://github.com/stylelint/vscode-stylelint/commit/07df9ea) test on [Travis CI](https://travis-ci.org/shinnn/vscode-stylelint)
    <!-- cspell:disable-next-line -->
- [e38df24](https://github.com/stylelint/vscode-stylelint/commit/e38df24) update ESLint to ^3.10.0 ESLint now supports a new `codeframe` formatter.
- [a7383d1](https://github.com/stylelint/vscode-stylelint/commit/a7383d1) update dependencies
- [adcf87b](https://github.com/stylelint/vscode-stylelint/commit/adcf87b) mention how to disable the built-in CSS linter (#39)

### [v0.18.2](https://github.com/stylelint/vscode-stylelint/tree/v0.18.2) (2016-11-09)

- [398fa11](https://github.com/stylelint/vscode-stylelint/commit/398fa11) update dependencies

### [v0.18.1](https://github.com/stylelint/vscode-stylelint/tree/v0.18.1) (2016-11-04)

- [17fa900](https://github.com/stylelint/vscode-stylelint/commit/17fa900) update dependencies

### [v0.18.0](https://github.com/stylelint/vscode-stylelint/tree/v0.18.0) (2016-10-21)

- [184a9e1](https://github.com/stylelint/vscode-stylelint/commit/184a9e1) upgrade to stylelint [v7.5.0](https://github.com/stylelint/stylelint/releases/tag/7.5.0)

### [v0.17.4](https://github.com/stylelint/vscode-stylelint/tree/v0.17.4) (2016-10-21)

- [0387379](https://github.com/stylelint/vscode-stylelint/commit/0387379) update dependencies

### [v0.17.3](https://github.com/stylelint/vscode-stylelint/tree/v0.17.3) (2016-10-12)

- [34297c7](https://github.com/stylelint/vscode-stylelint/commit/34297c7) update stylelint-vscode from v5.0.0 to v5.1.0 includes this important fix: https://github.com/shinnn/stylelint-vscode/commit/87bb779c11e3348b7ab41743fcee4ce93f9d32eb (close https://github.com/shinnn/vscode-stylelint/issues/35)

### [v0.17.2](https://github.com/stylelint/vscode-stylelint/tree/v0.17.2) (2016-10-12)

- [a8b0435](https://github.com/stylelint/vscode-stylelint/commit/a8b0435) upgrade to stylelint [v7.4.2](https://github.com/stylelint/stylelint/releases/tag/7.4.2)

### [v0.17.1](https://github.com/stylelint/vscode-stylelint/tree/v0.17.1) (2016-10-10)

- [ec282a4](https://github.com/stylelint/vscode-stylelint/commit/ec282a4) upgrade to stylelint [v7.4.1](https://github.com/stylelint/stylelint/releases/tag/7.4.1) https://github.com/stylelint/stylelint/pull/1965

### [v0.17.0](https://github.com/stylelint/vscode-stylelint/tree/v0.17.0) (2016-10-09)

- [616b78f](https://github.com/stylelint/vscode-stylelint/commit/616b78f) update dependencies and devDependencies includes stylelint minor update: https://github.com/stylelint/stylelint/releases/tag/7.4.0

### [v0.16.1](https://github.com/stylelint/vscode-stylelint/tree/v0.16.1) (2016-09-24)

- [3eaed0d](https://github.com/stylelint/vscode-stylelint/commit/3eaed0d) update dependencies
- [e6166fb](https://github.com/stylelint/vscode-stylelint/commit/e6166fb) add support for .stylelintrc intellisense (#33)

### [v0.16.0](https://github.com/stylelint/vscode-stylelint/tree/v0.16.0) (2016-09-21)

- [af33309](https://github.com/stylelint/vscode-stylelint/commit/af33309) upgrade to stylelint [v7.3.1](https://github.com/stylelint/stylelint/releases/tag/7.3.1)

### [v0.15.7](https://github.com/stylelint/vscode-stylelint/tree/v0.15.7) (2016-09-18)

- [6f47aac](https://github.com/stylelint/vscode-stylelint/commit/6f47aac) update dependencies

### [v0.15.6](https://github.com/stylelint/vscode-stylelint/tree/v0.15.6) (2016-09-17)

- [572b2ea](https://github.com/stylelint/vscode-stylelint/commit/572b2ea) update dependencies

### [v0.15.5](https://github.com/stylelint/vscode-stylelint/tree/v0.15.5) (2016-09-12)

- [0d734e2](https://github.com/stylelint/vscode-stylelint/commit/0d734e2) update dependencies

### [v0.15.4](https://github.com/stylelint/vscode-stylelint/tree/v0.15.4) (2016-09-07)

- [7201bf8](https://github.com/stylelint/vscode-stylelint/commit/7201bf8) update dependencies

### [v0.15.3](https://github.com/stylelint/vscode-stylelint/tree/v0.15.3) (2016-09-06)

- [827cecc](https://github.com/stylelint/vscode-stylelint/commit/827cecc) update vscode-languageclient and vscode-languageserver

### [v0.15.2](https://github.com/stylelint/vscode-stylelint/tree/v0.15.2) (2016-09-05)

- [eb29253](https://github.com/stylelint/vscode-stylelint/commit/eb29253) update caniuse-db and postcss-media-query-parser

### [v0.15.1](https://github.com/stylelint/vscode-stylelint/tree/v0.15.1) (2016-09-02)

- [f19f86a](https://github.com/stylelint/vscode-stylelint/commit/f19f86a) update dependencies

### [v0.15.0](https://github.com/stylelint/vscode-stylelint/tree/v0.15.0) (2016-08-30)

- [8b71dd1](https://github.com/stylelint/vscode-stylelint/commit/8b71dd1) update dependencies close https://github.com/shinnn/vscode-stylelint/issues/28

### [v0.14.4](https://github.com/stylelint/vscode-stylelint/tree/v0.14.4) (2016-08-25)

- [043ad15](https://github.com/stylelint/vscode-stylelint/commit/043ad15) pass the file name to stylelint (#26) Fixes shinnn/vscode-stylelint#22 and other issues related to a missing file name. For example, https://github.com/kristerkari/stylelint-scss/blob/master/src/rules/partial-no-import/README.md doesn't work without this parameter.

- [7d2e64a](https://github.com/stylelint/vscode-stylelint/commit/7d2e64a) update dependencies

### [v0.14.3](https://github.com/stylelint/vscode-stylelint/tree/v0.14.3) (2016-08-23)

- [0be659c](https://github.com/stylelint/vscode-stylelint/commit/0be659c) update dependencies, fix https://github.com/shinnn/vscode-stylelint/issues/23

### [v0.14.2](https://github.com/stylelint/vscode-stylelint/tree/v0.14.2) (2016-08-22)

- [5df1d40](https://github.com/stylelint/vscode-stylelint/commit/5df1d40) update dependencies

### [v0.14.1](https://github.com/stylelint/vscode-stylelint/tree/v0.14.1) (2016-08-08)

- [8d3ee59](https://github.com/stylelint/vscode-stylelint/commit/8d3ee59) update dependencies

### [v0.14.0](https://github.com/stylelint/vscode-stylelint/tree/v0.14.0) (2016-08-05)

- [c572471](https://github.com/stylelint/vscode-stylelint/commit/c572471) update stylelint from v7.0.3 to [7.1.0](https://github.com/stylelint/stylelint/releases/tag/7.1.0)

### [v0.13.3](https://github.com/stylelint/vscode-stylelint/tree/v0.13.3) (2016-08-01)

- [6edb270](https://github.com/stylelint/vscode-stylelint/commit/6edb270) update dependencies

### [v0.13.2](https://github.com/stylelint/vscode-stylelint/tree/v0.13.2) (2016-07-28)

- [fc226a1](https://github.com/stylelint/vscode-stylelint/commit/fc226a1) update dependencies

### [v0.13.1](https://github.com/stylelint/vscode-stylelint/tree/v0.13.1) (2016-07-21)

- [fda6275](https://github.com/stylelint/vscode-stylelint/commit/fda6275) update dependencies

### [v0.13.0](https://github.com/stylelint/vscode-stylelint/tree/v0.13.0) (2016-07-15)

- [ab9d60c](https://github.com/stylelint/vscode-stylelint/commit/ab9d60c) upgrade to stylelint [v7.x](https://github.com/stylelint/stylelint/releases/tag/7.0.0)
- [1a00366](https://github.com/stylelint/vscode-stylelint/commit/1a00366) reduce keywords, The keyword list is limited to 5 keywords.

### [v0.12.2](https://github.com/stylelint/vscode-stylelint/tree/v0.12.2) (2016-07-15)

- [0ee2d17](https://github.com/stylelint/vscode-stylelint/commit/0ee2d17) update dependencies

### [v0.12.1](https://github.com/stylelint/vscode-stylelint/tree/v0.12.1) (2016-07-13)

- [60be51a](https://github.com/stylelint/vscode-stylelint/commit/60be51a) update dependencies
- [a7a4512](https://github.com/stylelint/vscode-stylelint/commit/a7a4512) add keywords
- [d3763c6](https://github.com/stylelint/vscode-stylelint/commit/d3763c6) fix SCSS selector value close https://github.com/shinnn/vscode-stylelint/issues/19

### [v0.12.0](https://github.com/stylelint/vscode-stylelint/tree/v0.12.0) (2016-07-11)

- [9ce8b4c](https://github.com/stylelint/vscode-stylelint/commit/9ce8b4c) update dependencies Especially, https://github.com/stylelint/stylelint/releases/tag/6.9.0

### [v0.11.3](https://github.com/stylelint/vscode-stylelint/tree/v0.11.3) (2016-07-07)

- [a5783b0](https://github.com/stylelint/vscode-stylelint/commit/a5783b0) update caniuse-db and postcss-reporter

### [v0.11.2](https://github.com/stylelint/vscode-stylelint/tree/v0.11.2) (2016-07-05)

- [ef61466](https://github.com/stylelint/vscode-stylelint/commit/ef61466) update caniuse-db and loud-rejection

### [v0.11.1](https://github.com/stylelint/vscode-stylelint/tree/v0.11.1) (2016-07-05)

- [c1204b2](https://github.com/stylelint/vscode-stylelint/commit/c1204b2) update autoprefixer, browserslist and caniuse-db

### [v0.11.0](https://github.com/stylelint/vscode-stylelint/tree/v0.11.0) (2016-07-01)

- [fce5f00](https://github.com/stylelint/vscode-stylelint/commit/fce5f00) update [semver](https://github.com/npm/node-semver/commit/3cc5a94c15f5874b7c12f7cc5cf03f8f07b476ba) and [stylelint](https://github.com/stylelint/stylelint/releases/tag/6.8.0)

### [v0.10.3](https://github.com/stylelint/vscode-stylelint/tree/v0.10.3) (2016-06-28)

- [f63be49](https://github.com/stylelint/vscode-stylelint/commit/f63be49) bump [browserslist](https://github.com/ai/browserslist)
- [e03b735](https://github.com/stylelint/vscode-stylelint/commit/e03b735) make `null` valid type for config/configOverrides fix GH-18

### [v0.10.2](https://github.com/stylelint/vscode-stylelint/tree/v0.10.2) (2016-06-27)

- [ee6eaf1](https://github.com/stylelint/vscode-stylelint/commit/ee6eaf1) update dependencies https://github.com/stylelint/stylelint/releases/tag/6.7.1

### [v0.10.1](https://github.com/stylelint/vscode-stylelint/tree/v0.10.1) (2016-06-23)

- [bb22dd1](https://github.com/stylelint/vscode-stylelint/commit/bb22dd1) update array-to-error and caniuse-db

### [v0.10.0](https://github.com/stylelint/vscode-stylelint/tree/v0.10.0) (2016-06-21)

- [45c0462](https://github.com/stylelint/vscode-stylelint/commit/45c0462) update dependencies

### [v0.9.1](https://github.com/stylelint/vscode-stylelint/tree/v0.9.1) (2016-06-17)

- [c8c38dc](https://github.com/stylelint/vscode-stylelint/commit/c8c38dc) update dependencies

### [v0.9.0](https://github.com/stylelint/vscode-stylelint/tree/v0.9.0) (2016-06-16)

- [e49808c](https://github.com/stylelint/vscode-stylelint/commit/e49808c) update dependencies (https://github.com/stylelint/stylelint/releases/tag/6.6.0)

### [v0.8.8](https://github.com/stylelint/vscode-stylelint/tree/v0.8.8) (2016-06-05)

- [3e7e00a](https://github.com/stylelint/vscode-stylelint/commit/3e7e00a) update dependencies

### [v0.8.7](https://github.com/stylelint/vscode-stylelint/tree/v0.8.7) (2016-06-05)

- [69ea991](https://github.com/stylelint/vscode-stylelint/commit/69ea991) update [browserslist](https://github.com/ai/browserslist) and [sugarss](https://github.com/postcss/sugarss)

### [v0.8.6](https://github.com/stylelint/vscode-stylelint/tree/v0.8.6) (2016-05-29)

- [b171b7f](https://github.com/stylelint/vscode-stylelint/commit/b171b7f) update [caniuse-db](https://www.npmjs.com/package/caniuse-db)

### [v0.8.5](https://github.com/stylelint/vscode-stylelint/tree/v0.8.5) (2016-05-27)

- [e699fba](https://github.com/stylelint/vscode-stylelint/commit/e699fba) update [caniuse-db](https://www.npmjs.com/package/caniuse-db)

### [v0.8.4](https://github.com/stylelint/vscode-stylelint/tree/v0.8.4) (2016-05-25)

- [1a48aca](https://github.com/stylelint/vscode-stylelint/commit/1a48aca) add missing less references (#15) this specifically addresses issue #14 with the addition of `onLanguage:less`.

### [v0.8.3](https://github.com/stylelint/vscode-stylelint/tree/v0.8.3) (2016-05-24)

- [5cba3a5](https://github.com/stylelint/vscode-stylelint/commit/5cba3a5) update dependencies

### [v0.8.2](https://github.com/stylelint/vscode-stylelint/tree/v0.8.2) (2016-05-19)

- [bb9848a](https://github.com/stylelint/vscode-stylelint/commit/bb9848a) update dependencies

### [v0.8.1](https://github.com/stylelint/vscode-stylelint/tree/v0.8.1) (2016-05-14)

- [1486828](https://github.com/stylelint/vscode-stylelint/commit/1486828) update dependencies

### [v0.8.0](https://github.com/stylelint/vscode-stylelint/tree/v0.8.0) (2016-05-11)

- [de63cfe](https://github.com/stylelint/vscode-stylelint/commit/de63cfe) update stylehacks from v2.3.0 to 2.3.1 https://github.com/ben-eb/stylehacks/blob/7e2e8d5080d58820fbd0f76ea5dbbb93ef23c108/CHANGELOG.md#231

- [d648184](https://github.com/stylelint/vscode-stylelint/commit/d648184) enable this extension by default fix https://github.com/shinnn/vscode-stylelint/issues/10
- [7092f5e](https://github.com/stylelint/vscode-stylelint/commit/7092f5e) add `less` syntax support https://github.com/shinnn/vscode-stylelint/pull/6

### [v0.7.1](https://github.com/stylelint/vscode-stylelint/tree/v0.7.1) (2016-05-10)

- [9b1ccbb](https://github.com/stylelint/vscode-stylelint/commit/9b1ccbb) bump [language client and server](https://github.com/Microsoft/vscode-languageserver-node)

### [v0.7.0](https://github.com/stylelint/vscode-stylelint/tree/v0.7.0) (2016-04-27)

- [1777073](https://github.com/stylelint/vscode-stylelint/commit/1777073) upgrade to stylelint [v6.x](https://github.com/stylelint/stylelint/releases/tag/6.0.0)

### [v0.6.3](https://github.com/stylelint/vscode-stylelint/tree/v0.6.3) (2016-04-20)

0.6.1, 0.6.2 ws used for test releases.

- [b96b921](https://github.com/stylelint/vscode-stylelint/commit/b96b921) update dependencies

### [v0.6.0](https://github.com/stylelint/vscode-stylelint/tree/v0.6.0) (2016-04-15)

- [e8880d0](https://github.com/stylelint/vscode-stylelint/commit/e8880d0) use npm shrinkwrap fix https://github.com/shinnn/vscode-stylelint/issues/7

### [v0.5.0](https://github.com/stylelint/vscode-stylelint/tree/v0.5.0) (2016-03-19)

- [169e68e](https://github.com/stylelint/vscode-stylelint/commit/169e68e) update stylelint from v5.x to v6.x fix https://github.com/shinnn/vscode-stylelint/issues/5

### [v0.4.0](https://github.com/stylelint/vscode-stylelint/tree/v0.4.0) (2016-03-18)

- [eaf2f19](https://github.com/stylelint/vscode-stylelint/commit/eaf2f19) update dependencies
- [b0fd87c](https://github.com/stylelint/vscode-stylelint/commit/b0fd87c) upgrade to ESLint [v2.x](http://eslint.org/blog/2016/02/eslint-v2.0.0-released)

### [v0.3.1](https://github.com/stylelint/vscode-stylelint/tree/v0.3.1) (2016-02-13)

- [ce1493e](https://github.com/stylelint/vscode-stylelint/commit/ce1493e) show stack trace when non-stylelint error occurs

### [v0.3.0](https://github.com/stylelint/vscode-stylelint/tree/v0.3.0) (2016-02-11)

- [09011d7](https://github.com/stylelint/vscode-stylelint/commit/09011d7) add a note about `config` option that ignores file configs
- [984a53f](https://github.com/stylelint/vscode-stylelint/commit/984a53f) do not ignore file configs
- [3be0f1e](https://github.com/stylelint/vscode-stylelint/commit/3be0f1e) update dependencies and devDependencies

### [v0.2.0](https://github.com/stylelint/vscode-stylelint/tree/v0.2.0) (2015-12-23)

- [fc36692](https://github.com/stylelint/vscode-stylelint/commit/fc36692) watch [cosmiconfig-supported files](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/configuration.md#configuration)
- [509b0ce](https://github.com/stylelint/vscode-stylelint/commit/509b0ce) update dependencies and devDependencies
- [7d9a9db](https://github.com/stylelint/vscode-stylelint/commit/7d9a9db) init
