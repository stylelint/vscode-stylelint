# vscode-stylelint

![Testing](https://github.com/stylelint/vscode-stylelint/workflows/Testing/badge.svg)
![Linting](https://github.com/stylelint/vscode-stylelint/workflows/Linting/badge.svg)

The official [Visual Studio Code](https://code.visualstudio.com/) extension to lint [CSS](https://www.w3.org/Style/CSS/)/[SCSS](https://sass-lang.com/documentation/syntax)/[Less](http://lesscss.org/) with [stylelint](https://stylelint.io/)

![screenshot](media/screenshot.png)

> **Notice:** 1.x of this extension has breaking changes from 0.x versions, including, but not limited to, changes to which documents are linted by default. See the [migration section](#Migrating-from-vscode-stylelint-0.x/Stylelint-13.x) for more information.

The extension first looks for a copy of stylelint installed in the open workspace folder, then for a globally installed version if it can't find one.

## Installation

1. Execute the `Extensions: Install Extensions` command from the [Command Palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette).
2. Type `@id:stylelint.vscode-stylelint` into the search form and install the topmost one.

Read the [extension installation guide](https://code.visualstudio.com/docs/editor/extension-gallery) for more details.

### Recommended Setup (optional)

To prevent both [VS Code's built-in linters](https://code.visualstudio.com/docs/languages/css#_syntax-verification-linting) `[css]` `[less]` `[scss]` and this extension `[stylelint]` from reporting the same errors, disable the built-in linters in either the [user or workspace settings](https://code.visualstudio.com/docs/getstarted/settings):

```json
"css.validate": false,
"less.validate": false,
"scss.validate": false
```

<img width="430" alt="Screenshot of duplicate error messages" src="https://raw.githubusercontent.com/stylelint/vscode-stylelint/main/media/duplicate.png">

_An example of duplicate error messages from both the built-in linter and vscode-stylelint._

## Usage

Once a user follows [the stylelint startup guide](https://stylelint.io/user-guide/get-started) by creating a [configuration](https://stylelint.io/user-guide/configuration) file or by editing [`stylelint.*` VSCode settings](#extension-settings), stylelint automatically validates CSS and [PostCSS](https://marketplace.visualstudio.com/items?itemName=mhmadhamster.postcss-language) with [language identifiers](https://code.visualstudio.com/docs/languages/overview#_language-id) `css` and `postcss`, respectively.

<img width="430" alt="Screenshot of UI to select a language identifier" src="https://raw.githubusercontent.com/stylelint/vscode-stylelint/main/media/language.png">

_The UI to select a language identifier._

## Migrating from vscode-stylelint 0.x/Stylelint 13.x

### Stylelint 13.x and Prior is No Longer Supported

vscode-stylelint 1.x expects to use Stylelint 14 at minimum. Usage with prior versions of Stylelint is not supported nor recommended. If you want to continue using this extension, upgrade your copy of Stylelint to version 14 or later.

The `syntax` and `configOverrides` options have been removed from Stylelint 14 and this extension. See the next section for information on how to use different syntaxes.

### Stylelint is No Longer Bundled

Unlike in 0.x, 1.x no longer provides a copy of Stylelint bundled with the extension. Bundling Stylelint brought up many unwanted side effects and significantly increased the extension's size.

Starting with 1.x, vscode-stylelint will depend on having a copy of Stylelint installed in the open workspace (recommended) or globally (not recommended). If the extension doesn't seem to be linting any documents, make sure you have Stylelint installed.

### Only CSS and PostCSS are Validated by Default

The 0.x versions of this extension, which used Stylelint 13.x and prior, supported validating many different languages out of the box without any additional configuration. However, this added a lot of complexity and resulted in many cases of unwanted or unexpected behaviour.

In current versions of the extension, the extension only supports validating CSS and PostCSS out of the box and requires additional configuration to validate other languages. You will need to:

- Install the PostCSS syntax for the language you want to validate into your workspace (e.g. [postcss-html](https://www.npmjs.com/package/postcss-html) or [postcss-scss](https://www.npmjs.com/package/postcss-scss)).
- Configure Stylelint to use the syntax by providing it with the module name in the [`customSyntax` option](https://stylelint.io/user-guide/usage/options/#customsyntax) using overrides (or use the corresponding option [in this extension's settings](#stylelint.customSyntax)).

  Example Stylelint config:

  ```js
  module.exports = {
    overrides: [
      {
        files: ["**/*.scss"],
        customSyntax: "postcss-scss"
      }
    ]
  };
  ```

- [Add the language identifiers](#stylelint.validate) for the documents you want to validate to the extension's workspace or user settings.

  Example VS Code config:

  ```json
  {
    "stylelint.validate": ["css", "scss"]
  }
  ```

## Extension Settings

Though relying on a [stylelint configuration file](https://stylelint.io/user-guide/configure) in your project is highly recommended, you can instead use the following extension [settings](https://code.visualstudio.com/docs/getstarted/settings):

### `stylelint.enable`

> Type: `boolean`  
> Default: `true`

Controls whether this extension is enabled or not.

### `stylelint.config`

> Type: `Object`  
> Default: `null`

Sets the stylelint [`config`](https://stylelint.io/user-guide/usage/node-api#config) option. Note that when this option is enabled, stylelint doesn't load configuration files.

### `stylelint.configFile`

> Type: `string`  
> Default: `""`

Sets the stylelint [`configFile`](https://stylelint.io/user-guide/usage/options#configfile) option. Path to a JSON, YAML, or JS file that contains your configuration object. Use this option if you don't want stylelint to search for a configuration file.

### `stylelint.configBasedir`

> Type: `string`  
> Default: `""`

Sets the stylelint [`configBasedir`](https://stylelint.io/user-guide/usage/options#configbasedir) option. The path to the directory to which relative paths defining "extends" and "plugins" are relative. Only necessary if these values are relative paths.

### `stylelint.customSyntax`

> Type: `string`  
> Default: `""`

Sets the stylelint [`customSyntax`](https://stylelint.io/user-guide/usage/options#customsyntax) option. An absolute path to a custom [PostCSS-compatible](https://github.com/postcss/postcss#syntaxes) syntax module.

e.g.

```json
  "stylelint.customSyntax": "sugarss"
```

You can use `${workspaceFolder}` to refer to the folder opened in VS Code.

e.g.

```json
  "stylelint.customSyntax": "${workspaceFolder}/custom-syntax.js"
```

### `stylelint.ignoreDisables`

> Type: `boolean`  
> Default: `false`

Sets the stylelint [`ignoreDisables`](https://stylelint.io/user-guide/usage/options#ignoredisables) option. If `true`, stylelint ignores `styleline-disable` (e.g. `/* stylelint-disable block-no-empty */`) comments.

### `stylelint.reportNeedlessDisables`

> Type: `boolean`  
> Default: `false`

Sets the stylelint [`reportNeedlessDisables`](https://stylelint.io/user-guide/usage/options#reportneedlessdisables) option. If `true`, stylelint reports errors for `stylelint-disable` comments that are not blocking a lint warning.

### `stylelint.reportInvalidScopeDisables`

> Type: `boolean`  
> Default: `false`

Sets the stylelint [`reportInvalidScopeDisables`](https://stylelint.io/user-guide/usage/options#reportInvalidScopeDisables) option. If `true`, stylelint reports errors for `stylelint-disable` comments referring to rules that don't exist within the configuration object.

### `stylelint.validate`

> Type: `string[]`  
> Default: `["css","postcss"]`

An array of language identifiers specifying which files to validate.

### `stylelint.stylelintPath`

> Type: `string`  
> Default: `""`

Used to supply a custom path to the stylelint module.

### `stylelint.packageManager`

> Type: `"npm" | "yarn" | "pnpm"`  
> Default: `"npm"`

Controls the package manager to be used to resolve the stylelint library. This setting only has an effect if the stylelint library is resolved globally. Valid values are `"npm"` or `"yarn"` or `"pnpm"`.

### `stylelint.snippet`

> Type: `string[]`  
> Default: `["css","postcss"]`

An array of language identifiers specifying which files to enable snippets for.

### `editor.codeActionsOnSave`

This extension provides an action that you can use with VS Code's `editor.codeActionsOnSave` setting. If provided a `source.fixAll.stylelint` property set to `true`, all auto-fixable stylelint errors will be fixed on save.

```json
  "editor.codeActionsOnSave": {
    "source.fixAll.stylelint": true
  }
```

The following turns on auto fix for all providers, not just stylelint:

```json
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  }
```

You can also selectively disable stylelint:

```json
  "editor.codeActionsOnSave": {
    "source.fixAll": true,
    "source.fixAll.stylelint": false
  }
```

You can also selectively enable and disable specific languages using VS Code's language-scoped settings. For example, to disable `codeActionsOnSave` for HTML files, use the following:

```json
  "[html]": {
    "editor.codeActionsOnSave": {
      "source.fixAll.stylelint": false
    }
  }
```

## Commands

This extension contributes the following commands to the command palette:

- `Fix all auto-fixable problems`: applies stylelint resolutions to all automatically fixable problems.
