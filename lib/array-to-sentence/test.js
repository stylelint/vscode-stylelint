'use strict';

const arrayToSentence = require('.');
const test = require('tape');

test('arrayToSentence()', t => {
	t.equal(
		arrayToSentence(['foo', true, 1, null]),
		'foo, true, 1 and null',
		'should create a human-readable string from more than three elements.'
	);

	t.equal(
		arrayToSentence(['foo', true], {}),
		'foo and true',
		'should create a human-readable string from two elements.'
	);

	t.equal(
		arrayToSentence(['foo'], null),
		'foo',
		'should create a human-readable string from an elements.'
	);

	t.equal(arrayToSentence([]), '', 'should return an empty string if the array is empty.');

	t.equal(
		arrayToSentence(['a', 'c', 'e'], {separator: 'b', lastSeparator: 'd'}),
		'abcde',
		'should change the separator words in response to the options.'
	);

	t.throws(
		() => arrayToSentence(),
		/TypeError.*undefined is not an array/,
		'should throw a type error when it takes no arguments.'
	);

	t.throws(
		() => arrayToSentence('foo'),
		/TypeError.*foo is not an array/,
		'should throw a type error when the first argument is not an array.'
	);

	t.throws(
		() => arrayToSentence([], {separator: 1}),
		/TypeError.*must be a string/,
		'should throw a type error when `separator` option is not a string.'
	);

	t.throws(
		() => arrayToSentence([], {lastSeparator: ['']}),
		/TypeError.*must be a string/,
		'should throw a type error when `lastSeparator` option is not a string.'
	);

	t.end();
});
