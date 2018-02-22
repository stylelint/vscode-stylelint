# stylelint-vscode

[![npm version](https://img.shields.io/npm/v/stylelint-vscode.svg)](https://www.npmjs.com/package/stylelint-vscode)
[![Build Status](https://travis-ci.org/shinnn/stylelint-vscode.svg?branch=master)](https://travis-ci.org/shinnn/stylelint-vscode)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/stylelint-vscode.svg)](https://coveralls.io/github/shinnn/stylelint-vscode)

[stylelint](https://github.com/stylelint/stylelint) wrapper to easily integrate with [Visual Studio Code](https://code.visualstudio.com/) [language server](https://github.com/Microsoft/vscode-languageserver-node)

```javascript
const stylelintVSCode = require('stylelint-vscode');

const code = `
p {
  line-height: .8;
  color: red;
}`;

(async () => {
  await stylelintVSCode({
    code,
    config: {
      rules: {
        'number-leading-zero': 'always',
        'color-named': ['never', {severity: 'warning'}]
      }
    }
  }); /* => [{
    range: {
      start: {line: 2, character: 14},
      end: {line: 2, character: 14}
    },
    message: 'Expected a leading zero (number-leading-zero)',
    severity: 1,
    code: 'number-leading-zero',
    source: 'stylelint'
  }, {
    range: {
      start: {line: 3, character: 9},
      end: {line: 3, character: 9}
    },
    message: 'Unexpected named color "red" (color-no-named)',
    severity: 2,
    code: 'color-no-named',
    source: 'stylelint'
  }] */
})();
```

## Installation

[Use](https://docs.npmjs.com/cli/install) [npm](https://docs.npmjs.com/getting-started/what-is-npm).

```
npm install stylelint-vscode
```

## API

```javascript
const stylelintVSCode = require('stylelint-vscode');
```

### stylelintVSCode(*options*)

*options*: `Object` (directly passed to [`stylelint.lint`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#the-stylelint-node-api))  
Return: `Promise<Array<Object>>`

It works like [`stylelint.lint`](https://github.com/stylelint/stylelint/blob/893d050a24b47547fdf96c608f443f1f200eefa1/src/standalone.js#L16), except for:

* It will be resolved with an `Array` of [VS Code](https://github.com/Microsoft/vscode-extension-vscode)'s [`Diagnostic`](https://github.com/Microsoft/vscode-languageserver-node/blob/release/3.5.0/types/src/main.ts#L165-L192) instances.
* It will be *rejected* (not resolved) when it takes invalid configs.
  * In this case, it joins config errors into a single error object by using [array-to-error](https://github.com/shinnn/array-to-error).
* It suppresses `No configuration found` error.
  * Doing nothing when there is no configuration is a common behavior of editor plugins.
* [`code`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#code) option is required and [`files`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#files) option is not supported.
  * Because extensions can derive file contents via [`TextDocument#getText()`](https://code.visualstudio.com/docs/extensionAPI/vscode-api#TextDocument) and there is no need to read physical files again.

```javascript
const stylelintVSCode = require('stylelint-vscode');

(async () => {
  await stylelintVSCode({
    code: '{foo}'
  }); /*=> [{
    range: {
      start: {line: 0, character: 1},
      end: {line: 0, character: 1}
    },
    message: 'Unknown word (CssSyntaxError)',
    severity: 1,
    code: 'CssSyntaxError',
    source: 'stylelint'
  }] */
});
```

```javascript
(async () => {
  try {
    await stylelintVSCode({
      code: 'a {}',
      config: {
        rules: {
          indentation: 2,
          'function-comma-space-before': 'foo'
        }
      }
    });
  } catch (err) {
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
  }
})();
```

## License

Copyright (c) 2015 - 2018 [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).
