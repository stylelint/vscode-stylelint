/*!
 * stylelint-vscode | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/stylelint-vscode
*/
'use strict';

const inspect = require('util').inspect;

const arrayToError = require('array-to-error');
const isPlainObj = require('is-plain-obj');
const stylelint = require('stylelint');

module.exports = function stylelintVSCode(options) {
  if (!isPlainObj(options)) {
    return Promise.reject(new TypeError(
      'Expected an object containing stylelint API options, but got ' +
      inspect(options) +
      '.'
    ));
  }

  return stylelint.lint(Object.assign({}, options, {files: null}))
  .catch(function suppressNoConfigurationFoundError(err) {
    if (
      err.message.startsWith('No configuration provided for') ||
      /No rules found within configuration/.test(err.message)
    ) {
      // Check only CSS syntax errors without applying any stylelint rules
      return stylelint.lint(Object.assign({}, options, {
        config: {
          rules: {}
        },
        files: null
      }));
    }

    return Promise.reject(err);
  })
  .then(report => {
    const invalidOptionWarnings = report.results[0].invalidOptionWarnings;
    if (invalidOptionWarnings.length !== 0) {
      const texts = invalidOptionWarnings.map(warning => warning.text);
      return Promise.reject(arrayToError(texts, SyntaxError));
    }

    return report.results[0].warnings.map(warning => {
      const position = {
        line: warning.line - 1,
        character: warning.column - 1
      };

      return {
        message: warning.text,
        // https://github.com/Microsoft/vscode-languageserver-node/blob/v2.6.2/types/src/main.ts#L130-L147
        severity: warning.severity === 'warning' ? 2 : 1,
        source: 'stylelint',
        range: {
          start: position,
          end: position
        }
      };
    });
  });
};
