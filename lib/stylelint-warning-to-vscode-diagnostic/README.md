# stylelint-warning-to-vscode-diagnostic

[![npm version](https://img.shields.io/npm/v/stylelint-warning-to-vscode-diagnostic.svg)](https://www.npmjs.com/package/stylelint-warning-to-vscode-diagnostic)
[![Build Status](https://travis-ci.org/shinnn/stylelint-warning-to-vscode-diagnostic.svg?branch=master)](https://travis-ci.org/shinnn/stylelint-warning-to-vscode-diagnostic)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/stylelint-warning-to-vscode-diagnostic.svg)](https://coveralls.io/github/shinnn/stylelint-warning-to-vscode-diagnostic?branch=master)

Convert a [stylelint](https://github.com/stylelint/stylelint) warning into a [Visual Studio Code diagnostic](https://code.visualstudio.com/Docs/extensionAPI/vscode-api#Diagnostic)

```javascript
const {lint} = require('stylelint');
const stylelintWarningToVscodeDiagnostic = require('stylelint-warning-to-vscode-diagnostic');

(async () => {
  const [result] = await lint({
    code: 'a { color: red; }',
    config: {
      rules: {
        'color-named': 'never'
      }
    }
  });

  const [warning] = result.warnings;
  /* {
    rule: 'color-named',
    text: 'Unexpected named color "red" (color-named)',
    severity: 'error',
    line: 1,
    column: 12
  } */

  stylelintWarningToVscodeDiagnostic(warnings);
  /* {
    message: 'Unexpected named color "red" (color-named)',
    severity: 1,
    source: 'stylelint',
    range: {
      start: {
        line: 0,
        character: 11
      },
      end: {
        line: 0,
        character: 11
      }
    }
  } */
})();
```

## Installation

[Use](https://docs.npmjs.com/cli/install) [npm](https://docs.npmjs.com/getting-started/what-is-npm).

```
npm install stylelint-warning-to-vscode-diagnostic
```

## API

```javascript
const stylelintWarningToVscodeDiagnostic = require('stylelint-warning-to-vscode-diagnostic');
```

### stylelintWarningToVscodeDiagnostic(*warning*)

*warning*: `Object` (stylelint [warning](https://github.com/stylelint/stylelint/blob/9.1.1/lib/createStylelintResult.js#L127-L131))  
Return: `Object` (VS Code [diagnostic](https://github.com/Microsoft/vscode-languageserver-node/blob/release/3.5.0/types/src/main.ts#L165-L192))

## License

Copyright (c) 2017 - 2018 [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).
