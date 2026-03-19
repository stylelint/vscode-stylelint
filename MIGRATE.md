# Migration Guide

## From vscode-stylelint 1.x to 2.x

vscode-stylelint 2.x is the first version of the extension to support Stylelint 17.x. It's also backwards compatible with older version of Stylelint, down to 14.x.

It requires VS Code version 1.103.0 or later.

## From vscode-stylelint 0.x to 1.x

### Stylelint 13.x and Prior is No Longer Supported

> See also: [Stylelint 14 migration guide](https://github.com/stylelint/stylelint/blob/main/docs/migration-guide/to-14.md)

vscode-stylelint 1.x expects to use Stylelint 14 at minimum. Usage with prior versions of Stylelint is no longer supported. While older versions may continue to work for a while, you may encounter unexpected behaviour. You should upgrade your copy of Stylelint to version 14 or later for the best experience.

The `syntax` and `configOverrides` options have been removed from Stylelint 14 and this extension. See the [following section](#%EF%B8%8F-only-css-and-postcss-are-validated-by-default) for information on how to use different syntaxes.

### Stylelint is No Longer Bundled

Unlike 0.x, 1.x no longer provides a copy of Stylelint bundled with the extension. Bundling Stylelint brought up many unwanted side effects and significantly increased the extension's size.

Starting with 1.x, vscode-stylelint will depend on having a copy of Stylelint installed in the open workspace (recommended) or globally (not recommended). If the extension doesn't seem to be linting any documents, make sure you have Stylelint installed.

### Only CSS and PostCSS are Validated by Default

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
