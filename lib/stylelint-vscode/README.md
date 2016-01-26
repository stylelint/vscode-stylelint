# stylelint-vscode

[![NPM version](https://img.shields.io/npm/v/stylelint-vscode.svg)](https://www.npmjs.com/package/stylelint-vscode)
[![Build Status](https://travis-ci.org/shinnn/stylelint-vscode.svg?branch=master)](https://travis-ci.org/shinnn/stylelint-vscode)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/stylelint-vscode.svg)](https://coveralls.io/github/shinnn/stylelint-vscode)
[![Dependency Status](https://david-dm.org/shinnn/stylelint-vscode.svg)](https://david-dm.org/shinnn/stylelint-vscode)
[![devDependency Status](https://david-dm.org/shinnn/stylelint-vscode/dev-status.svg)](https://david-dm.org/shinnn/stylelint-vscode#info=devDependencies)

[stylelint](https://github.com/stylelint/stylelint) wrapper to easily integrate with [Visual Studio Code](https://code.visualstudio.com/) [language server](https://github.com/Microsoft/vscode-languageserver-node)

```javascript
const stylelintVSCode = require('stylelint-vscode');

const code = `
p {
  line-height: .8;
  color: red;
}`;

stylelintVSCode({
  code,
  config: {
    rules: {
      'number-leading-zero': 'always',
      'color-no-named': {warn: true}
    }
  }
}).then(diagnostics => {
  diagnostics;
  /* =>
    [
      {
        message: 'stylelint: Expected a leading zero (number-leading-zero)',
        severity: 1,
        range: {
          start: {
            line: 2,
            character: 14
          },
          end: {
            line: 2,
            character: 14
          }
        }
      },
      {
        message: 'stylelint: Unexpected named color "red" (color-no-named)',
        severity: 2,
        range: {
          start: {
            line: 3,
            character: 9
          },
          end: {
            line: 3,
            character: 9
          }
        }
      }
    ]
  */
});
```

## Installation

[Use npm.](https://docs.npmjs.com/cli/install)

```
npm install stylelint-vscode
```

## API

```javascript
const stylelintVSCode = require('stylelint-vscode');
```

### stylelintVSCode(*options*)

*options*: `Object` (directly passed to [`stylelint.lint`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#the-stylelint-node-api))  
Return: [`Promise`](http://www.ecma-international.org/ecma-262/6.0/#sec-promise-constructor) instance

It works like [`stylelint.lint`](https://github.com/stylelint/stylelint/blob/24f237bdefd3759ebd222f6cfa808b60b213b554/src/standalone.js#L9), except for:

* It will be resolved with an array of [VS Code](https://github.com/Microsoft/vscode-extension-vscode)'s [`Diagnostic`](https://github.com/Microsoft/vscode-extension-vscode/blob/0.10.6/vscode.d.ts#L2220) instances.
* It converts [CSS syntax error](https://github.com/postcss/postcss/blob/77d80ef830f5e822e8fdc1aaed0a98f51ffb8cc5/lib/css-syntax-error.es6#L5) to an array of one `Diagnostic` instance.
* It will be *rejected* (not resolved) when it takes invalid configs.
  * In this case, it joins config errors into a single error object by using [array-to-error](https://github.com/shinnn/array-to-error).
* It suppresses `No configuration found` error.
  * Doing nothing when there is no config configuration is a common behavior of editor plugins.

```javascript
const stylelintVSCode = require('stylelint-vscode');

stylelintVSCode({
  code: '{foo}'
}).then(diagnostics => {
  diagnostics;
  /* =>
    {
      message: 'stylelint: Unknown word',
      severity: 1,
      range: {
        start: {
          line: 0,
          character: 1
        },
        end: {
          line: 0,
          character: 1
        }
      }
    }
  */
});

stylelintVSCode({
  code: 'a {}',
  config: {
    rules: {
      indentation: 2,
      'function-comma-space-before': 'foo'
    }
  }
}).catch(err => {
  err.name;
  //=> 'SyntaxError'

  err.message;
  //=> 'Expected option value for rule "indentation"\nInvalid option value "foo" for rule "function-comma-space-before"'

  err.reasons;
  /* =>
    [
      'Expected option value for rule "indentation"',
      'Invalid option value "foo" for rule "function-comma-space-before"'
    ]
  */
});
```

## License

Copyright (c) 2015 - 2016 [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).
