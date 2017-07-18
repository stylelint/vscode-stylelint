'use strict';

const {resolve} = require('path');

const stylelintVSCode = require('..');
const test = require('tape');

// https://github.com/Microsoft/vscode-languageserver-node/blob/release/3.3.0/types/src/main.ts#L137-L157
const ERROR = 1;
const WARNING = 2;

test('stylelintVSCode()', t => {
  t.plan(18);

  t.equal(stylelintVSCode.name, 'stylelintVSCode', 'should have a function name.');

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
          message: 'Expected single quotes (string-quotes)',
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
          severity: WARNING,
          source: 'stylelint'
        },
        {
          message: 'Expected indentation of 0 tabs (indentation)',
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
          severity: ERROR,
          source: 'stylelint'
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
        message: 'Unknown word (CssSyntaxError)',
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
        severity: ERROR,
        source: 'stylelint'
      }
    ], 'should be resolved with one diagnostic when the CSS is broken.');
  }).catch(t.fail);

  stylelintVSCode({code: 'a{}'}).then(diagnostics => {
    t.deepEqual(
      diagnostics,
      [],
      'should not be rejected even if no configs are defined.'
    );
  }).catch(t.fail);

  stylelintVSCode({
    code: '//Hi',
    syntax: 'scss',
    config: {
      rules: {}
    }
  }).then(diagnostics => {
    t.deepEqual(
      diagnostics,
      [],
      'should support non-standard CSS syntax with `syntax` option.'
    );
  }).catch(t.fail);

  stylelintVSCode({
    code: 'a { color: #000 }',
    codeFilename: resolve('should-be-ignored.css'),
    config: {
      rules: {
        'color-hex-length': 'long'
      },
      ignoreFiles: '**/*-ignored.css'
    }
  }).then(diagnostics => {
    t.deepEqual(
      diagnostics,
      [],
      'should support `codeFilename` option.'
    );
  }).catch(t.fail);

  stylelintVSCode({code: 'a{color:rgba(}'})
  .then(diagnostics => {
    t.deepEqual(diagnostics, [
      {
        message: 'Unclosed bracket (CssSyntaxError)',
        range: {
          end: {
            line: 0,
            character: 12
          },
          start: {
            line: 0,
            character: 12
          }
        },
        severity: ERROR,
        source: 'stylelint'
      }
    ], 'should check CSS syntax even if no configration is provided.');
  }).catch(t.fail);

  stylelintVSCode({code: '@', config: {}})
  .then(diagnostics => {
    t.deepEqual(diagnostics, [
      {
        message: 'At-rule without name (CssSyntaxError)',
        range: {
          end: {
            line: 0,
            character: 0
          },
          start: {
            line: 0,
            character: 0
          }
        },
        severity: ERROR,
        source: 'stylelint'
      }
    ], 'should check CSS syntax even if no rule is provided.');
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
        'at-rule-empty-line-before': ['always', {bar: true}]
      }
    }
  }).then(t.fail, err => {
    const expected = [
      'Invalid option value "foo" for rule "color-hex-case"',
      'Invalid option name "bar" for rule "at-rule-empty-line-before"'
    ];

    t.equal(
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
    t.equal(
      err.message,
      'Undefined rule this-rule-does-not-exist',
      'should be rejected when the rules include unknown one.'
    );
  }).catch(t.fail);

  stylelintVSCode(Buffer.from('foo')).then(t.fail, err => {
    t.equal(
      err.message,
      'Expected an object containing stylelint API options, but got <Buffer 66 6f 6f>.',
      'should be rejected when the first argument is not a plain object.'
    );
  }).catch(t.fail);

  stylelintVSCode({files: ['src/*.css']}).then(t.fail, err => {
    t.ok(
      err.message.startsWith('[ \'src/*.css\' ] was passed to `file` option'),
      'should be rejected when `files` option is provided.'
    );
  }).catch(t.fail);

  stylelintVSCode({}).then(t.fail, err => {
    t.equal(
      err.message,
      '`code` option is required but not provided.',
      'should be rejected when `code` option is not provided.'
    );
  }).catch(t.fail);

  stylelintVSCode({code: null}).then(t.fail, err => {
    t.equal(
      err.message,
      '`code` option must be a string, but received a non-string value null.',
      'should be rejected when a non-string value is passed to `code` option.'
    );
  }).catch(t.fail);

  stylelintVSCode().then(t.fail, err => {
    t.equal(
      err.message,
      'Expected an object containing stylelint API options, but got undefined.',
      'should be rejected when it takes no argument.'
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
          message: 'Unexpected unit (length-zero-no-unit)',
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
          severity: ERROR,
          source: 'stylelint'
        }
      ],
      'should adhere configuration file settings.'
    );
  }).catch(t.fail);
});
