'use strict';

const test = require('tape');
const { lint } = require('stylelint');

const fn = require('.');

test('stylelintWarningToVscodeDiagnostic()', async (t) => {
	const {
		results: [{ warnings }],
	} = await lint({
		code: `a {
			color: #AAA;
			border-color: #bbbbbb;
    }`,
		config: {
			rules: {
				'color-hex-case': ['lower'],
				'color-hex-length': ['short', { severity: 'warning' }],
			},
		},
	});

	t.deepEqual(
		fn(warnings[0]),
		{
			message: 'Expected "#AAA" to be "#aaa" (color-hex-case)',
			range: {
				end: {
					line: 1,
					character: 10,
				},
				start: {
					line: 1,
					character: 10,
				},
			},
			severity: 1,
			code: 'color-hex-case',
			source: 'stylelint',
		},
		'should convert a stylelint warning into a VS Code diagnostic.',
	);

	t.deepEqual(
		fn(warnings[1]),
		{
			message: 'Expected "#bbbbbb" to be "#bbb" (color-hex-length)',
			range: {
				end: {
					line: 2,
					character: 17,
				},
				start: {
					line: 2,
					character: 17,
				},
			},
			severity: 2,
			code: 'color-hex-length',
			source: 'stylelint',
		},
		'should consider severity level.',
	);

	t.end();
});
