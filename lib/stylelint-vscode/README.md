# stylelint-vscode

[![npm version](https://img.shields.io/npm/v/stylelint-vscode.svg)](https://www.npmjs.com/package/stylelint-vscode)
[![Build Status](https://travis-ci.org/shinnn/stylelint-vscode.svg?branch=master)](https://travis-ci.org/shinnn/stylelint-vscode)
[![Build status](https://ci.appveyor.com/api/projects/status/ncmsp5lp5gke8mci/branch/master?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/stylelint-vscode/branch/master)
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

It works like [`stylelint.lint`](https://github.com/stylelint/stylelint/blob/9.1.1/lib/index.js#L24), except for:

* It will be resolved with an `Array` of [VS Code `Diagnostic`](https://github.com/Microsoft/vscode-languageserver-node/blob/release/4.0.0/types/src/main.ts#L181-L208) instances.
* It will be *rejected* (not resolved) when it takes invalid configs.
  * In this case, it joins config errors into a single error object by using [array-to-error](https://github.com/shinnn/array-to-error).
* It suppresses `No configuration found` error.
  * Doing nothing when there is no configuration is a common behavior of editor plugins.
* [`code`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#code) option is required and [`files`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#files) option is not supported.
  * Because extensions can derive file contents via [`TextDocument#getText()`](https://code.visualstudio.com/docs/extensionAPI/vscode-api#TextDocument) and there is no need to read physical files again.
* It ignores JavaScript files when stylelint doesn't load either [stylelint-processor-glamorous](https://github.com/zabute/stylelint-processor-glamorous) or [stylelint-processor-styled-components](https://github.com/styled-components/stylelint-processor-styled-components).

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

## Related project

* [vscode-stylelint](https://github.com/shinnn/vscode-stylelint) — A VS Code extension powered by this module

## License

[ISC License](./LICENSE) © 2018 Shinnosuke Watanabe
