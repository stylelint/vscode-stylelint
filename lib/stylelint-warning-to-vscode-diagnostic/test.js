'use strict';

const fn = require('.');
const {lint} = require('stylelint');
const test = require('tape');

test('stylelintWarningToVscodeDiagnostic()', async t => {
	const {results: [{warnings}]} = await lint({
		code: `a {
      color: #AAA;
      border-color: #bbbbbb;
    }`,
		config: {
			rules: {
				'color-hex-case': ['lower'],
				'color-hex-length': ['short', {severity: 'warning'}]
			}
		}
	});

	t.deepEqual(fn(warnings[0]), {
		message: 'Expected "#AAA" to be "#aaa" (color-hex-case)',
		range: {
			end: {
				line: 1,
				character: 13
			},
			start: {
				line: 1,
				character: 13
			}
		},
		severity: 1,
		code: 'color-hex-case',
		source: 'stylelint'
	}, 'should convert a stylelint warning into a VS Code diagnostic.');

	t.deepEqual(fn(warnings[1]), {
		message: 'Expected "#bbbbbb" to be "#bbb" (color-hex-length)',
		range: {
			end: {
				line: 2,
				character: 20
			},
			start: {
				line: 2,
				character: 20
			}
		},
		severity: 2,
		code: 'color-hex-length',
		source: 'stylelint'
	}, 'should consider severity level.');

	t.throws(
		() => fn(),
		/Expected a stylelint warning.*line: <number>, colum: <number>, rule: <string>, severity: <string>, text: <string>/,
		'should throw an error when it takes no arguments.'
	);

	t.throws(
		() => fn(Symbol('hi')),
		/^TypeError.*, but got Symbol\(hi\)\./,
		'should throw an error when it takes a non-object argument.'
	);

	t.throws(
		() => fn({line: Buffer.from('0')}),
		/^TypeError.*`line` property of a stylelint warning must be a number, but it was <Buffer 30>\./,
		'should throw an error when `line` is a non-number value.'
	);

	t.throws(
		() => fn({line: 10, column: new Set()}),
		/^TypeError.*`column` property of a stylelint warning must be a number, but it was Set {}\./,
		'should throw an error when `column` is a non-number value.'
	);

	t.throws(
		() => fn({line: 10, column: 10, text: ['?']}),
		/^TypeError.*`text` property of a stylelint warning must be a string, but it was \[ '\?' ]\./,
		'should throw an error when `text` is not a string.'
	);

	t.throws(
		() => fn({line: 10, column: 10, text: '***'}),
		/^TypeError.*`severity` property of a stylelint warning must be either 'error' or 'warning'/,
		'should throw an error when `severity` is not provided.'
	);

	t.throws(
		() => fn({line: 10, column: 10, text: '***', severity: new Uint16Array(3)}),
		/^TypeError.*, but it was a non-string value Uint16Array \[ 0, 0, 0 ]\./,
		'should throw an error when `severity` is a non-string value.'
	);

	t.throws(
		() => fn({line: 10, column: 10, text: '***', severity: 'errror'}),
		/^Error.*, but it was 'errror'\./,
		'should throw an error when `severity` is an invalid value.'
	);

	t.end();
});
