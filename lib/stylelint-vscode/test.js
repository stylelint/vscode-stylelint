'use strong';

const {DiagnosticSeverity} = require('vscode-languageserver');
const stylelintVSCode = require('.');
const {test} = require('tape');

test('stylelintVSCode()', function(t) {
  t.plan(7);

  t.strictEqual(stylelintVSCode.name, 'stylelintVSCode', 'should have a function name.');

  stylelintVSCode({
    code: '  a[id="id"]{}',
    config: {
      rules: {
        'string-quotes': [1, 'single'],
        indentation: [2, 'tab']
      }
    }
  }).then(diagnostics => {
    t.deepEqual(
      diagnostics,
      [
        {
          message: 'stylelint: Expected single quotes (string-quotes)',
          range: {
            end: {
              line: 0,
              character: 7
            },
            start: {
              line: 0,
              character: 7
            }
          },
          severity: DiagnosticSeverity.Warning
        },
        {
          message: 'stylelint: Expected indentation of 0 tabs (indentation)',
          range: {
            end: {
              line: 0,
              character: 2
            },
            start: {
              line: 0,
              character: 2
            }
          },
          severity: DiagnosticSeverity.Error
        }
      ],
      'should be resolved with diagnostics when it lints CSS successfully.'
    );
  }).catch(t.fail);

  stylelintVSCode({code: '', configOverrides: {rules: {indentation: [2, 2]}}}).then(diagnostics => {
    t.deepEqual(
      diagnostics,
      [],
      'should be resolved with an empty array when no errors and warnings are reported.'
    );
  }).catch(t.fail);

  stylelintVSCode({code: '\n1', config: {rules: {indentation: [2, 'tab']}}})
  .then(diagnostics => {
    t.deepEqual(diagnostics, [
      {
        message: 'stylelint: Unknown word',
        range: {
          end: {
            line: 1,
            character: 0
          },
          start: {
            line: 1,
            character: 0
          }
        },
        severity: 1
      }
    ], 'should be resolved with one diagnostic when the CSS is broken.');
  });

  stylelintVSCode({code: 'a{}'})
  .then(t.fail, err => {
    t.strictEqual(
      err.message,
      'No rules found within configuration',
      'should be rejected when no rules found within configuration.'
    );
  });

  stylelintVSCode({
    code: '  a[id="id"]{}',
    config: {
      rules: {
        'string-quotes': [1, 'single'],
        'color-hex-case': [2, 'foo'],
        indentation: 2
      }
    }
  }).then(t.fail, err => {
    const expected = [
      'Invalid option value "foo" for rule "color-hex-case"',
      'Expected option value for rule "indentation"'
    ];

    t.strictEqual(
      err.message,
      expected.join('\n'),
      'should be rejected when it takes incorrect options.'
    );
    t.deepEqual(
      err.reasons,
      expected,
      'should add `reason` property to the error when it takes incorrect options.'
    );
  }).catch(t.fail);
});
