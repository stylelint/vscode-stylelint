# vscode-stylelint

[![Testing](https://github.com/stylelint/vscode-stylelint/actions/workflows/testing.yml/badge.svg)](https://github.com/stylelint/vscode-stylelint/actions/workflows/testing.yml)

The official [Visual Studio Code](https://code.visualstudio.com/) extension for [Stylelint](https://stylelint.io/).

<img width="449" alt="Screenshot of Stylelint errors displayed in VS Code" src="https://raw.githubusercontent.com/stylelint/vscode-stylelint/main/media/screenshot.png">

<!-- cspell:disable-next-line -->

**Table of Contents**

- [Installation](#installation)
  - [Disable VS Code's Built-In Linters (optional)](#disable-vs-codes-built-in-linters-optional)
- [Usage](#usage)
  - [Commands](#commands)
  - [Actions](#actions)
  - [Document Formatting](#document-formatting)
  - [Extension Settings](#extension-settings)
- [Migrating](#migrating)
  - [From vscode-stylelint 1.x](#from-vscode-stylelint-1x)
  - [From vscode-stylelint 0.x/Stylelint 13.x](#from-vscode-stylelint-0xstylelint-13x)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Licence](#licence)

## Installation

You can install the extension from the [Command Palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette):

1. Execute the `Extensions: Install Extensions` command
2. Type `@id:stylelint.vscode-stylelint` into the search form
3. Install the topmost one with the verified publisher mark.

For more details, you can read the [VS Code's extension installation guide](https://code.visualstudio.com/docs/editor/extension-gallery).

### Disable VS Code's Built-In Linters (optional)

You can disable VS Code's [built-in linters](https://code.visualstudio.com/docs/languages/css#_syntax-verification-linting) either in the [user or workspace settings](https://code.visualstudio.com/docs/getstarted/settings).

For example, to disable the built-in CSS, Less, and SCSS linters:

```json
  "css.validate": false,
  "less.validate": false,
  "scss.validate": false
```

<img width="430" alt="Screenshot of duplicate error messages" src="https://raw.githubusercontent.com/stylelint/vscode-stylelint/main/media/duplicate.png">

_An example of duplicate error messages emitted by both the built-in linter and vscode-stylelint._

## Usage

> See the [Stylelint getting started guide](https://stylelint.io/user-guide/get-started) for more information.

The extension will automatically lint CSS and [PostCSS](https://marketplace.visualstudio.com/items?itemName=mhmadhamster.postcss-language) documents (those with [language identifiers](https://code.visualstudio.com/docs/languages/overview#_language-identifier) `css` and `postcss`, respectively) once you create a [Stylelint configuration file](https://stylelint.io/user-guide/configure) (or configure [the Stylelint extension's settings](#extension-settings)) and install Stylelint.

<img width="430" alt="Screenshot of UI to select a language identifier" src="https://raw.githubusercontent.com/stylelint/vscode-stylelint/main/media/language.png">

_You can see or change the current document's language in the bottom-right corner of the editor window._

You can use the [`stylelint.validate`](#stylelintvalidate) extension setting to lint additional languages.

For example, to additionally lint SCSS:

```json
  "stylelint.validate": ["css", "postcss", "scss"],
```

Or to additionally lint CSS-in-JS in JSX and TSX:

```json
  "stylelint.validate": ["css", "postcss", "javascriptreact", "typescriptreact"],
```

The extension first looks for a copy of Stylelint installed in the open workspace folder, then for a globally installed version if it can't find one. If neither can be found, it will not lint any documents.

### Commands

The extension adds two commands to the command palette:

- `Fix all auto-fixable problems` - apply fixes to all automatically fixable problems
- `Restart Stylelint Server` - restart the Stylelint LSP and runtime server

### Actions

The extension provides an action that you can use with VS Code's [`editor.codeActionsOnSave`](https://code.visualstudio.com/docs/getstarted/settings) setting.

#### `editor.codeActionsOnSave`

You can automatically fix all auto-fixable problems on save by setting the `source.fixAll.stylelint` property to `explicit`:

```json
  "editor.codeActionsOnSave": {
    "source.fixAll.stylelint": "explicit"
  }
```

Or turn on auto fix for all providers, not just Stylelint:

```json
  "editor.codeActionsOnSave": {
    "source.fixAll": "explicit"
  }
```

You can also selectively disable Stylelint:

```json
  "editor.codeActionsOnSave": {
    "source.fixAll": "explicit",
    "source.fixAll.stylelint": "never"
  }
```

You can also selectively enable and disable specific languages using VS Code's language-scoped settings. For example, to disable `codeActionsOnSave` for HTML files, use the following:

```json
  "[html]": {
    "editor.codeActionsOnSave": {
      "source.fixAll.stylelint": "never"
    }
  }
```

### Document Formatting

This extension registers as a document formatter for validated languages. However, **document formatting is only available with Stylelint 14 and 15**. Starting with Stylelint 16, [stylistic rules were removed](https://stylelint.io/migration-guide/to-16#removed-deprecated-stylistic-rules) from Stylelint and moved to the [@stylistic/stylelint-plugin](https://www.npmjs.com/package/@stylistic/stylelint-plugin) package.

When using Stylelint 14 or 15, you can format a document by running the `Format Document` command from the command palette or by using the keyboard shortcut (by default, `Shift`+`Alt`+`F` on Windows/Linux and `Shift`+`Option`+`F` on macOS).

This will **only** apply the formatting configuration from your editor settings by mapping them to the stylistic rules in Stylelint. It will not apply any fixes for other lint warnings or errors.

**If you're using Stylelint 16 or later** and try to format a document, you'll see a message explaining that formatting isn't available. For auto-fixing lint issues, you have two options:

1. Run the `Fix all auto-fixable problems` command from the command palette.
2. Configure `editor.codeActionsOnSave` in your settings to automatically fix issues on save:

```json
  "editor.codeActionsOnSave": {
    "source.fixAll.stylelint": "explicit"
  }
```

If you need stylistic formatting with Stylelint 16+, consider using a dedicated code formatter like [Prettier](https://prettier.io/) alongside Stylelint for linting.

### Extension Settings

Though relying on a [Stylelint configuration file](https://stylelint.io/user-guide/configure) in your project is highly recommended, you can instead use the following [extension settings](https://code.visualstudio.com/docs/getstarted/settings):

#### `stylelint.enable`

> Type: `boolean`  
> Default: `true`

Controls whether this extension is enabled or not.

#### `stylelint.logLevel`

> Type: `"error" | "warn" | "info" | "debug"`  
> Default: `"info"`

Controls the log level used by the Stylelint extension and language server. Restart the extension host or the window after changing the setting, since it's picked up at initialization.

#### `stylelint.validate`

> Type: `string[]`  
> Default: `["css", "postcss"]`

An array of [language identifiers](https://code.visualstudio.com/docs/languages/identifiers#_known-language-identifiers) specifying which files to validate.

#### `stylelint.snippet`

> Type: `string[]`  
> Default: `["css", "postcss"]`

An array of language identifiers specifying which files to enable snippets for.

#### `stylelint.stylelintPath`

> Type: `string`  
> Default: `""`

Used to supply a custom path to the Stylelint module.

#### `stylelint.packageManager`

> Type: `"npm" | "yarn" | "pnpm"`  
> Default: `"npm"`

Controls the package manager to be used to resolve the Stylelint library. This setting only has an effect if the Stylelint library is resolved globally. Valid values are `"npm"` or `"yarn"` or `"pnpm"`.

#### `stylelint.rules.customizations`

> Type: `object[]`  
> Default: `[]`

An array of rule customizations that let you override the severity level of Stylelint rules. This is useful for downgrading errors to warnings, upgrading warnings to errors, or completely suppressing specific rules in the editor.

Each customization object has the following properties:

- `rule`: A string pattern matching the rule name. Supports wildcards and negation patterns:
  - Exact match: `"color-named"` matches only the `color-named` rule.
  - Wildcard: `"color-*"` matches all rules starting with `color-`.
  - Negation: `"!color-*"` matches all rules except those starting with `color-`.
- `severity`: The severity level to apply.
  - `"error"`: Show as error (red underline).
  - `"warn"`: Show as warning (yellow underline).
  - `"info"`: Show as information (blue underline).
  - `"off"`: Don't show the diagnostic.
  - `"default"`: Use the original severity from Stylelint.
  - `"downgrade"`: Convert errors to warnings, warnings to info messages.
  - `"upgrade"`: Convert info to warnings, warnings to errors.

Customizations are applied in order, with later rules taking priority over earlier ones. This means that more general patterns should come before more specific ones for the specific rules to override the general ones.

Example:

```json
{
  "stylelint.rules.customizations": [
    {
      "rule": "font-*",
      "severity": "info"
    },
    {
      "rule": "!color-*",
      "severity": "info"
    },
    {
      "rule": "declaration-block-*",
      "severity": "default"
    },
    {
      "rule": "comment-word-disallowed-list",
      "severity": "off"
    },
    {
      "rule": "color-named",
      "severity": "warn"
    }
  ]
}
```

#### `stylelint.config`

> Type: `Object`  
> Default: `null`

Sets the Stylelint [`config`](https://stylelint.io/user-guide/usage/node-api#config) option. Note that when this option is enabled, Stylelint doesn't load configuration files.

#### `stylelint.configFile`

> Type: `string`  
> Default: `""`

Sets the Stylelint [`configFile`](https://stylelint.io/user-guide/usage/options#configfile) option. Path to a JSON, YAML, or JS file that contains your configuration object. Use this option if you don't want Stylelint to search for a configuration file.

#### `stylelint.configBasedir`

> Type: `string`  
> Default: `""`

Sets the Stylelint [`configBasedir`](https://stylelint.io/user-guide/usage/options#configbasedir) option. The path to the directory to which relative paths defining "extends" and "plugins" are relative. Only necessary if these values are relative paths.

#### `stylelint.customSyntax`

> Type: `string`  
> Default: `""`

Sets the Stylelint [`customSyntax`](https://stylelint.io/user-guide/usage/options/#customsyntax) option, which points to a [PostCSS syntax](https://github.com/postcss/postcss#syntaxes) module. Must be either the package name or an absolute path to the module.

e.g.

```json
  "stylelint.customSyntax": "sugarss"
```

You can use `${workspaceFolder}` to refer to the folder opened in VS Code.

e.g.

```json
  "stylelint.customSyntax": "${workspaceFolder}/custom-syntax.js"
```

#### `stylelint.ignoreDisables`

> Type: `boolean`  
> Default: `false`

Sets the Stylelint [`ignoreDisables`](https://stylelint.io/user-guide/usage/options/#ignoredDisables) option. If `true`, Stylelint ignores `stylelint-disable` (e.g. `/* stylelint-disable block-no-empty */`) comments.

#### `stylelint.reportDescriptionlessDisables`

> Type: `boolean`  
> Default: `false`

Sets the Stylelint [`reportDescriptionlessDisables`](https://stylelint.io/user-guide/options/#reportdescriptionlessdisables) option. If `true`, Stylelint reports `stylelint-disable` comments without a description.

#### `stylelint.reportNeedlessDisables`

> Type: `boolean`  
> Default: `false`

Sets the Stylelint [`reportNeedlessDisables`](https://stylelint.io/user-guide/options/#reportneedlessdisables) option. If `true`, Stylelint reports errors for `stylelint-disable` comments that are not blocking a lint warning.

#### `stylelint.reportInvalidScopeDisables`

> Type: `boolean`  
> Default: `false`

Sets the Stylelint [`reportInvalidScopeDisables`](https://stylelint.io/user-guide/options/#reportinvalidscopedisables) option. If `true`, Stylelint reports errors for `stylelint-disable` comments referring to rules that don't exist within the configuration object.

## Migrating

Migrating from previous major versions of the extension.

### From vscode-stylelint 1.x

vscode-stylelint 2.x is the first version of the extension to support Stylelint 17.x. It's also backwards compatible with older version of Stylelint, down to 14.x.

It requires VS Code version 1.103.0 or later.

### From vscode-stylelint 0.x/Stylelint 13.x

#### Stylelint 13.x and Prior is No Longer Supported

> See also: [Stylelint 14 migration guide](https://github.com/stylelint/stylelint/blob/main/docs/migration-guide/to-14.md)

vscode-stylelint 1.x expects to use Stylelint 14 at minimum. Usage with prior versions of Stylelint is no longer supported. While older versions may continue to work for a while, you may encounter unexpected behaviour. You should upgrade your copy of Stylelint to version 14 or later for the best experience.

The `syntax` and `configOverrides` options have been removed from Stylelint 14 and this extension. See the [following section](#%EF%B8%8F-only-css-and-postcss-are-validated-by-default) for information on how to use different syntaxes.

#### Stylelint is No Longer Bundled

Unlike 0.x, 1.x no longer provides a copy of Stylelint bundled with the extension. Bundling Stylelint brought up many unwanted side effects and significantly increased the extension's size.

Starting with 1.x, vscode-stylelint will depend on having a copy of Stylelint installed in the open workspace (recommended) or globally (not recommended). If the extension doesn't seem to be linting any documents, make sure you have Stylelint installed.

#### Only CSS and PostCSS are Validated by Default

The 0.x versions of this extension, which used Stylelint 13.x and prior, supported validating many different languages out of the box without any additional configuration. However, this added a lot of complexity and resulted in many cases of unwanted or unexpected behaviour.

In current versions of the extension, the extension only supports validating CSS and PostCSS out of the box and requires additional configuration to validate other languages. You will need to:

1. Install the PostCSS syntax for the language you want to validate into your workspace, e.g. [postcss-scss](https://www.npmjs.com/package/postcss-scss).
   <!-- prettier-ignore -->
   <!-- cspell:disable-next-line -->
1. Configure Stylelint to use the syntax by providing the module name in the [`customSyntax`](https://stylelint.io/user-guide/usage/options/#customsyntax) option using overrides (or use the [corresponding option](#stylelintcustomsyntax) in this extension's settings).

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

    <!-- prettier-ignore -->
    <!-- cspell:disable-next-line -->

1. Add the [language identifiers](https://code.visualstudio.com/docs/languages/overview#_language-identifier) for the documents you want to validate to the extension's workspace or user settings using the [`stylelint.validate`](#stylelintvalidate) option.

   Example VS Code config:

   ```json
   {
     "stylelint.validate": ["css", "scss"]
   }
   ```

## Troubleshooting

vscode-stylelint writes logs to the VS Code output panel:

![Screenshot of the Output window](https://user-images.githubusercontent.com/9868643/139115502-ff3daa37-1793-47da-9ef9-70c5706f018a.png)

You can enable more verbose log output by setting the [`logLevel`](#stylelintloglevel) extension setting or by running VS Code with the `NODE_ENV` environment variable set to `development`. You can do this on macOS and \*nix by running:

```sh
NODE_ENV=development code
```

And on Windows by running:

```batch
cmd /C "set NODE_ENV=development&&code"
```

## Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for details.

## Licence

[MIT](LICENSE)
