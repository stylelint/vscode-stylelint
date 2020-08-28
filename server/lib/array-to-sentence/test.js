'use strict';

const test = require('tape');

const arrayToSentence = require('.');

test('arrayToSentence()', (t) => {
	t.equal(
		arrayToSentence(['foo', true, 1, null]),
		'foo, true, 1 and null',
		'should create a human-readable string from more than three elements.',
	);

	const options = {};

	t.equal(
		arrayToSentence(['foo', true], options),
		'foo and true',
		'should create a human-readable string from two elements.',
	);

	t.deepEqual(options, {}, 'should treat the passed options object immutable way.');

	t.equal(
		arrayToSentence(['foo'], null),
		'foo',
		'should create a human-readable string from an elements.',
	);

	t.equal(arrayToSentence([]), '', 'should return an empty string if the array is empty.');

	t.equal(
		arrayToSentence(['a', 'c', 'e'], { separator: 'b', lastSeparator: 'd' }),
		'abcde',
		'should change the separator words in response to the options.',
	);

	t.throws(
		() => arrayToSentence(),
		/TypeError.*Expected an array, but got a non-array value undefined\./,
		'should throw a type error when it takes no arguments.',
	);

	t.throws(
		() => arrayToSentence('foo'),
		/TypeError.*Expected an array, but got a non-array value foo\./,
		'should throw a type error when the first argument is not an array.',
	);

	t.throws(
		() => arrayToSentence([], { separator: 1 }),
		/TypeError.*Expected `separator` option to be a string, but got a non-string value 1\./,
		'should throw a type error when `separator` option is not a string.',
	);

	t.throws(
		() => arrayToSentence([], { lastSeparator: NaN }),
		/TypeError.*Expected `lastSeparator` option to be a string, but got a non-string value NaN\./,
		'should throw a type error when `lastSeparator` option is not a string.',
	);

	t.end();
});
