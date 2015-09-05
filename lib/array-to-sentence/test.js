'use strong';

const test = require('tape');

function runTest(description, main) {
  test(description, t => {
    t.plan(10);

    t.equal(main.name, 'arrayToSentence', 'should have a function name.');

    t.equal(
      main(['foo', true, 1, null]),
      'foo, true, 1 and null',
      'should create a human-readable string from more than three elements.'
    );

    t.equal(
      main(['foo', true], {}),
      'foo and true',
      'should create a human-readable string from two elements.'
    );

    t.equal(
      main(['foo'], null),
      'foo',
      'should create a human-readable string from an elements.'
    );

    t.equal(main([]), '', 'should return an empty string if the array is empty.');

    t.equal(
      main(['a', 'c', 'e'], {separator: 'b', lastSeparator: 'd'}),
      'abcde',
      'should change the separator words in response to the options.'
    );

    t.throws(
      () => main(),
      /TypeError.*undefined is not an array/,
      'should throw a type error when it takes no arguments.'
    );

    t.throws(
      () => main('foo'),
      /TypeError.*foo is not an array/,
      'should throw a type error when the first argument is not an array.'
    );

    t.throws(
      () => main([1, 2], {separator: 1}),
      /TypeError.*must be a string/,
      'should throw a type error when `separator` option is not a string.'
    );

    t.throws(
      () => main([1, 2], {lastSeparator: ['']}),
      /TypeError.*must be a string/,
      'should throw a type error when `lastSeparator` option is not a string.'
    );
  });
}

runTest('require(\'array-to-sentence\')', require('.'));

global.window = {};
require('./' + require('./bower.json').main);

runTest('window.arrayToSentence', window.arrayToSentence);
