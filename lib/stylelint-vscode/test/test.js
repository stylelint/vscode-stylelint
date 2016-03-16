'use strong';

const {DiagnosticSeverity} = require('vscode-languageserver');
const stylelintVSCode = require('..');
const {test} = require('tape');

test('stylelintVSCode()', t => {
  t.plan(9);

  t.strictEqual(stylelintVSCode.name, 'stylelintVSCode', 'should have a function name.');

  stylelintVSCode({
    code: '  a[id="id"]{}',
    config: {
      rules: {
        'string-quotes': ['single', {severity: 'warning'}],
        indentation: ['tab']
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

  stylelintVSCode({code: '', config: {rules: {indentation: [2]}}}).then(diagnostics => {
    t.deepEqual(
      diagnostics,
      [],
      'should be resolved with an empty array when no errors and warnings are reported.'
    );
  }).catch(t.fail);

  stylelintVSCode({code: '\n1', config: {rules: {indentation: ['tab']}}})
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

  stylelintVSCode({code: 'a{}'}).then(diagnostics => {
    t.deepEqual(
      diagnostics,
      [],
      'should not be rejected even if no configs are defined.'
    );
  }).catch(t.fail);

  stylelintVSCode({code: 'a{}', config: {}}).then(diagnostics => {
    t.deepEqual(
      diagnostics,
      [],
      'should not be rejected even if no rules are defined.'
    );
  }).catch(t.fail);

  stylelintVSCode({
    code: '  a[id="id"]{}',
    config: {
      rules: {
        'string-quotes': 'single',
        'color-hex-case': 'foo',
        'rule-nested-empty-line-before': ['always', {bar: true}]
      }
    }
  }).then(t.fail, err => {
    const expected = [
      'Invalid option value "foo" for rule "color-hex-case"',
      'Invalid option name "bar" for rule "rule-nested-empty-line-before"'
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

  stylelintVSCode({
    code: 'b{}',
    config: {
      rules: {
        'this-rule-does-not-exist': 1,
        'this-rule-also-does-not-exist': 1
      }
    }
  }).then(t.fail, err => {
    t.strictEqual(
      err.message,
      'Undefined rule "this-rule-does-not-exist"',
      'should be rejected when the rules include unknown one.'
    );
  }).catch(t.fail);
});

test('stylelintVSCode() with a configration file', t => {
  t.plan(1);

  process.chdir(__dirname);

  stylelintVSCode({
    code: 'a {\n  width: 0px;\n};\n',
    configOverrides: {rules: {indentation: [2]}}
  }).then(diagnostics => {
    t.deepEqual(
      diagnostics,
      [
        {
          message: 'stylelint: Unexpected unit on zero length number (number-zero-length-no-unit)',
          range: {
            end: {
              line: 1,
              character: 10
            },
            start: {
              line: 1,
              character: 10
            }
          },
          severity: DiagnosticSeverity.Error
        }
      ],
      'should adhere configuration file settings.'
    );
  }).catch(t.fail);
});
