# vscode-stylelint

[![Build Status](https://travis-ci.org/shinnn/vscode-stylelint.svg?branch=master)](https://travis-ci.org/shinnn/vscode-stylelint)
[![Dependency Status](https://david-dm.org/shinnn/vscode-stylelint.svg)](https://david-dm.org/shinnn/vscode-stylelint)
[![devDependency Status](https://david-dm.org/shinnn/vscode-stylelint/dev-status.svg)](https://david-dm.org/shinnn/vscode-stylelint#info=devDependencies)

A [Visual Studio Code](https://code.visualstudio.com/) extension to lint [CSS](https://www.w3.org/Style/CSS/)/[SCSS](http://sass-lang.com/documentation/file.SASS_REFERENCE.html#syntax)/[Less](http://lesscss.org/) with [stylelint](http://stylelint.io/)

![screenshot](screenshot.png)

## Installation

1. Run [`Install Extension`](https://code.visualstudio.com/docs/editor/extension-gallery#_install-an-extension) command from [Command Palette](https://code.visualstudio.com/Docs/editor/codebasics#_command-palette).
2. Search and choose `stylelint`.

See the [extension installation guide](https://code.visualstudio.com/docs/editor/extension-gallery) for details.

## Usage

Enable the linter in the VS Code [settings](https://code.visualstudio.com/docs/customization/userandworkspace), while disabling the built-in CSS linter:

```json
{
  "stylelint.enable": true,
  "css.validate": false
}
```

### Configurations

*In addition to the VS Code settings mentioned below, you can set the config by adding [stylelint configuration files](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/configuration.md#configuration) to the workspace directory.*

#### stylelint.enable

Type: `Boolean`  
Default: `true`

Control whether [stylelint](https://github.com/stylelint/stylelint/) is enabled for CSS/SCSS/Less files or not.

#### stylelint.configOverrides

Type: `Object`  
Default: `null`

Will be directly passed to [`configOverrides`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#configoverrides) option.

#### stylelint.config

Type: `Object`  
Default: `null`

Will be directly passed to [`config`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#config) option. Note that if you set `config` option, this plugin ignores all the stylelint configuration files.

## License

Copyright (c) 2015 - 2017 [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).
