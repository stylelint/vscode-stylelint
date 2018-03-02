# vscode-stylelint

[![Build Status](https://travis-ci.org/shinnn/vscode-stylelint.svg?branch=master)](https://travis-ci.org/shinnn/vscode-stylelint)

A [Visual Studio Code](https://code.visualstudio.com/) extension to lint [CSS](https://www.w3.org/Style/CSS/)/[SCSS](https://sass-lang.com/documentation/file.SASS_REFERENCE.html#syntax)/[Less](http://lesscss.org/) with [stylelint](https://stylelint.io/)

![screenshot](screenshot.png)

## Installation

1. Execute `Extensions: Install Extensions` command from [Command Palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette).
2. Type `@sort:installs stylelint` into the search form and install the topmost one.

Read the [extension installation guide](https://code.visualstudio.com/docs/editor/extension-gallery) for more details.

### Optional (but recommended) setup

<img align="right" width="430" alt="duplicate messages from both the built-in linter and vscode-stylelint" src="media/duplicate.png">

To prevent both [the VSCode built-in CSS linter](https://code.visualstudio.com/docs/languages/css#_syntax-verification-linting) `[css]` and this extension `[stylelint]` reporting the same CSS errors like in the screenshot, you can disable the built-in ones in User or Workspace [setting](https://code.visualstudio.com/docs/getstarted/settings):

```json
"css.validate": false,
"less.validate": false,
"scss.validate": false
```

## Usage

Once you follow [the stylelint startup guide](https://github.com/stylelint/stylelint#getting-started) by creating a [configuration](https://stylelint.io/user-guide/configuration/) file or edit [`stylelint.*` VSCode settings](#extension-settings), stylelint automatically validates documents with these [language identifiers](https://code.visualstudio.com/docs/languages/overview#_language-id):

* CSS (`css`)
* HTML (`html`)
* Less (`less`)
* Markdown (`markdown`)
* [Markdown+MathML (`source.markdown.math`)](https://marketplace.visualstudio.com/items?itemName=goessner.mdmath)
* [PostCSS (`postcss`)](https://marketplace.visualstudio.com/items?itemName=mhmadhamster.postcss-language)
* [Sass (`sass`)](https://marketplace.visualstudio.com/items?itemName=robinbentley.sass-indented)
* SCSS (`scss`)
* [Sugarss (`sugarss`)](https://marketplace.visualstudio.com/items?itemName=mhmadhamster.postcss-language)
* [Vue (`vue`)](https://marketplace.visualstudio.com/items?itemName=octref.vetur)
* [Vue-HTML (`vue-html`)](https://marketplace.visualstudio.com/items?itemName=octref.vetur)
* XML (`xml`)

### Extension settings

Though it's highly recommended to add a [stylelint configuration file](https://stylelint.io/user-guide/example-config/) to your workspace folder instead, you can also use the following extension [settings](https://code.visualstudio.com/docs/getstarted/settings).

#### stylelint.enable

Type: `boolean`  
Default: `true`

Control whether [stylelint](https://github.com/stylelint/stylelint/) is enabled or not.

#### stylelint.configOverrides

Type: `Object`  
Default: `null`

Will be directly passed to [`configOverrides`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#configoverrides) option.

#### stylelint.config

Type: `Object`  
Default: `null`

Will be directly passed to [`config`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#config) option. Note that if you set `config` option, this plugin ignores all the stylelint configuration files.

#### stylelint.additionalDocumentSelectors

Type: `Array<string>`  
Default: `[]`

Document types that you can use to run stylelint against if you are using CSS inside document types like: `javascriptreact`, `typescriptreact`.

## License

Copyright (c) 2015 - 2018 [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).
