# stylelint-vscode

> 🚧 Inlined dependency taken from [https://github.com/shinnn/stylelint-vscode](https://github.com/shinnn/stylelint-vscode).

---

A [stylelint](https://github.com/stylelint/stylelint) wrapper to easily integrate with [Visual Studio Code](https://code.visualstudio.com/) [language server](https://github.com/Microsoft/vscode-languageserver-node)

```javascript
const stylelintVSCode = require("stylelint-vscode");
const { TextDocument } = require("vscode-languageserver-types");

(async () => {
  await stylelintVSCode(
    TextDocument.create(
      "file:///Users/me/0.css",
      "css",
      1,
      `
p {
  line-height: .8;
  color: red;
}`
    ),
    {
      code,
      config: {
        rules: {
          "number-leading-zero": "always",
          "color-named": ["never", { severity: "warning" }]
        }
      }
    }
  ); /* => [{
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
const stylelintVSCode = require("stylelint-vscode");
```

### stylelintVSCode(_textDocument_ [, *options*])

_textDocument_: [`TextDocument`](https://code.visualstudio.com/docs/extensionAPI/vscode-api#TextDocument)  
_options_: `Object` (directly passed to [`stylelint.lint`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#the-stylelint-nodejs-api))  
Return: `Promise<Array<Object>>`

It works like [`stylelint.lint()`](https://github.com/stylelint/stylelint/blob/10.0.1/lib/index.js#L31), except for:

- [`code`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#code) and [`codeFilename`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#codefilename) option values are derived from a `TextDocument` passed to the first argument.
- It will be resolved with an `Array` of [VS Code `Diagnostic`](https://github.com/Microsoft/vscode-languageserver-node/blob/release/types/3.14/types/src/main.ts#L508-L546) instances.
- It will be _rejected_ (not resolved) when it takes invalid configs.
  - In this case, it joins config errors into a single error object.
- It suppresses `No configuration found` error.
  - Doing nothing when there is no configuration is a common behavior of editor plugins.
- [`files`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#files) and [`formatter`](https://github.com/stylelint/stylelint/blob/master/docs/user-guide/node-api.md#formatter) options are not supported.

```javascript
const stylelintVSCode = require("stylelint-vscode");

async () => {
  await stylelintVSCode(
    TextDocument.create("file:///Users/me/1.css", "css", 1, "{foo}")
  ); /*=> [{
    range: {
      start: {line: 0, character: 1},
      end: {line: 0, character: 1}
    },
    message: 'Unknown word (CssSyntaxError)',
    severity: 1,
    code: 'CssSyntaxError',
    source: 'stylelint'
  }] */
};
```

```javascript
(async () => {
  try {
    await stylelintVSCode(
      TextDocument.create("file:///Users/me/2.css", "css", 1, "a {}"),
      {
        config: {
          rules: {
            indentation: 2,
            "function-comma-space-before": "foo"
          }
        }
      }
    );
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
