'use strict';

const inspectWithKind = require('.');
const Observable = require('zen-observable');
const test = require('tape');

test('inspectWithKind()', (t) => {
	t.equal(inspectWithKind(true), 'true (boolean)', 'should append type when it takes a boolean.');

	t.equal(
		inspectWithKind('Hi\0'),
		"'Hi\\u0000' (string)",
		'should append type when it takes a string.',
	);

	t.equal(inspectWithKind(-0), '-0 (number)', 'should append type when it takes a number.');

	t.equal(inspectWithKind(1n), '1n (bigint)', 'should not append type when it takes a bigint.');

	t.equal(
		inspectWithKind(Array.from({ length: 30 }, (v, k) => k)),
		'[\n  0, 1, 2, 3, 4,\n  5, 6, 7, 8, 9,\n  ... 20 more items\n] (array)',
		'should append type when it takes an array.',
	);

	t.equal(
		inspectWithKind(/\0/u),
		'/\\0/u (regexp)',
		'should append type when it takes a regular expression.',
	);

	t.equal(
		inspectWithKind(new Date('1970')),
		'1970-01-01T00:00:00.000Z (date)',
		'should append type when it takes a date object.',
	);

	t.equal(
		inspectWithKind({
			a: {
				b: {
					c: 'x'.repeat(30),
				},
			},
		}),
		`{ a: { b: { c: '${'x'.repeat(30)}' } } } (object)`,
		'should append type when it takes a date object.',
	);

	(function () {
		t.equal(
			inspectWithKind(arguments), // eslint-disable-line prefer-rest-params
			"[Arguments] { '0': '!', '1': '?' } (arguments)",
			'should append type when it takes an argument object.',
		);
	})('!', '?');

	t.equal(
		inspectWithKind(undefined),
		'undefined',
		'should not append type when it takes undefined.',
	);

	t.equal(inspectWithKind(null), 'null', 'should not append type when it takes null.');

	t.equal(
		inspectWithKind(Math.sign),
		'[Function: sign]',
		'should not append type when it takes a function.',
	);

	t.equal(
		inspectWithKind(async () => {}),
		'[AsyncFunction (anonymous)]',
		'should not append type when it takes an async function.',
	);

	t.equal(
		inspectWithKind(new TypeError('abc')),
		'TypeError: abc',
		'should not append type when it takes an error.',
	);

	t.equal(
		inspectWithKind(Buffer.from('0')),
		'<Buffer 30>',
		'should not append type when it takes a Buffer.',
	);

	t.equal(inspectWithKind(new Set()), 'Set {}', 'should not append type when it takes a Set.');

	t.equal(inspectWithKind(new Map()), 'Map {}', 'should not append type when it takes a Map.');

	t.equal(
		inspectWithKind(Symbol('^_^')),
		'Symbol(^_^)',
		'should not append type when it takes a symbol.',
	);

	t.equal(
		inspectWithKind(Promise.resolve(new WeakMap())),
		'Promise { WeakMap { <items unknown> } }',
		'should not append type when it takes a Promise.',
	);

	t.equal(
		inspectWithKind(new Observable(() => {})),
		'Observable { _subscriber: [Function (anonymous)] }',
		'should not append type when it takes an Observable.',
	);

	t.equal(
		inspectWithKind([1], { maxArrayLength: 0 }),
		'[ ... 1 more item ] (array)',
		'should support util.inspect options.',
	);

	t.end();
});
