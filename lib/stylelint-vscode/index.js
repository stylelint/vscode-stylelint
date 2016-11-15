/*!
 * stylelint-vscode | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/stylelint-vscode
*/
'use strict';

const arrayToError = require('array-to-error');
const stylelint = require('stylelint');

module.exports = function stylelintVSCode(options) {
  return stylelint.lint(Object.assign({}, options, {
    code: '',
    files: null
  }))
  .then(function validateRules(firstReport) {
    const invalidOptionWarnings = firstReport.results[0].invalidOptionWarnings;
    if (invalidOptionWarnings.length !== 0) {
      const texts = invalidOptionWarnings.map(warning => warning.text);
      return Promise.reject(arrayToError(texts, SyntaxError));
    }

    return stylelint.lint(options);
  }, function suppressNoConfigurationFoundError(err) {
    if (
      err.message.startsWith('No configuration provided for') ||
      /No rules found within configuration/.test(err.message)
    ) {
      // Check only CSS syntax errors without applying any stylelint rules
      return stylelint.lint(Object.assign({}, options, {
        config: {
          rules: {}
        }
      }));
    }

    return Promise.reject(err);
  }).then(function makeDiagnostics(report) {
    const diagnostics = [];

    report.results.forEach(result => {
      result.warnings.forEach(warning => {
        diagnostics.push({
          message: warning.text,
          // https://github.com/Microsoft/vscode-languageserver-node/blob/27476b45819ca891e73d338f9e7d90cbd0d02781/types/src/main.ts#L127-L147
          severity: warning.severity === 'warning' ? 2 : 1,
          range: {
            start: {
              line: warning.line - 1,
              character: warning.column - 1
            },
            end: {
              line: warning.line - 1,
              character: warning.column - 1
            }
          },
          source: 'stylelint'
        });
      });
    });

    return diagnostics;
  });
};
