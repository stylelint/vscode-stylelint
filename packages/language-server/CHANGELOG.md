# Changelog

## 1.1.1 - 2026-03-31

- Fixed: code action and completion requests now respect LSP cancellation tokens, responding with RequestCancelled per the LSP specification ([#897](https://github.com/stylelint/vscode-stylelint/pull/897)) ([@adalinesimonian](https://github.com/adalinesimonian)).
- Fixed: reduced unnecessary lint cycles during rapid typing by debouncing validation ([#896](https://github.com/stylelint/vscode-stylelint/pull/896)) ([@adalinesimonian](https://github.com/adalinesimonian)).
- Fixed: stale diagnostics briefly appearing when the document changes while a lint is in progress ([#896](https://github.com/stylelint/vscode-stylelint/pull/896)) ([@adalinesimonian](https://github.com/adalinesimonian)).

## 1.1.0 - 2026-03-20

- Added: `stylelint/status` notification reporting whether the server ran successfully for a document ([#889](https://github.com/stylelint/vscode-stylelint/pull/889)) ([@adalinesimonian](https://github.com/adalinesimonian)).
- Fixed: Duplicate workers being started due to drive letter case sensitivity on Windows ([#891](https://github.com/stylelint/vscode-stylelint/pull/891)) ([@adalinesimonian](https://github.com/adalinesimonian)).
- Fixed: Workers not recovering from crashes due to counting the same crash multiple times when multiple requests are pending ([#891](https://github.com/stylelint/vscode-stylelint/pull/891)) ([@adalinesimonian](https://github.com/adalinesimonian)).

## 1.0.1 - 2026-03-19

- Fixed: worker process failing to start when server started as ESM ([#883](https://github.com/stylelint/vscode-stylelint/pull/883)) ([@adalinesimonian](https://github.com/adalinesimonian)).

## 1.0.0 - 2026-03-18

- Added: initial release of the Stylelint language server ([#870](https://github.com/stylelint/vscode-stylelint/pull/870)) ([@adalinesimonian](https://github.com/adalinesimonian)).
