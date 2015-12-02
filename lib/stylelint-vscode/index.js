/*!
 * stylelint-vscode | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/stylelint-vscode
*/
'use strict';

const arrayToError = require('array-to-error');
const DiagnosticSeverity = require('vscode-languageserver').DiagnosticSeverity;
const stylelint = require('stylelint');

module.exports = function stylelintVSCode(options) {
  return stylelint.lint(Object.assign({}, options, {code: '\n', files: null}))
  .then(function validateRules(firstReport) {
    if (firstReport.results[0].warnings.length !== 0) {
      const texts = firstReport.results[0].warnings.map(warning => warning.text);
      return Promise.reject(arrayToError(texts, SyntaxError));
    }

    // Workaround for
    // https://github.com/stylelint/stylelint/blob/3.1.3/src/standalone.js#L19
    if (options && options.code === '') {
      options = Object.assign({}, options, {code: '\n'});
    }

    return stylelint.lint(options);
  }).then(function makeDiagnostics(report) {
    const diagnostics = [];

    report.results.forEach(result => {
      result.warnings.forEach(warning => {
        diagnostics.push({
          message: `stylelint: ${warning.text}`,
          severity: warning.severity === 'warning' ?
                    DiagnosticSeverity.Warning :
                    DiagnosticSeverity.Error,
          range: {
            start: {
              line: warning.line - 1,
              character: warning.column - 1
            },
            end: {
              line: warning.line - 1,
              character: warning.column - 1
            }
          }
        });
      });
    });

    return Promise.resolve(diagnostics);
  }, function(err) {
    if (err.hasOwnProperty('line') && typeof err.line === 'number') {
      return Promise.resolve([{
        message: `stylelint: ${err.reason}`,
        severity: DiagnosticSeverity.Error,
        range: {
          start: {
            line: err.line - 1,
            character: err.column - 1
          },
          end: {
            line: err.line - 1,
            character: err.column - 1
          }
        }
      }]);
    }

    return Promise.reject(err);
  });
};
