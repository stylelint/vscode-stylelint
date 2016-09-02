'use strict';

const requireBowerFiles = require('require-bower-files');
const requireFromString = require('require-from-string');
const {rollup} = require('rollup');
const rollupNodeResolve = require('rollup-plugin-node-resolve');
const test = require('tape');

global.window = {};
requireBowerFiles({self: true});

function runTest(arrayToError, description) {
  test(description, t => {
    t.plan(10);

    t.strictEqual(arrayToError.name, 'arrayToError', 'should have a function name.');

    const err = arrayToError(['a', 'b']);
    t.strictEqual(err.constructor, Error, 'should create an error instance.');
    t.equal(err.message, 'a\nb', 'should create an error message by joining strings.');
    t.deepEqual(err.reasons, ['a', 'b'], 'should add `reasons` property to the error.');

    const err2 = arrayToError(['a', 'b'], TypeError);
    t.strictEqual(err2.constructor, TypeError, 'ghould use its second argument as an error constructor.');
    t.equal(arrayToError(['a'], undefined).message, 'a', 'should accept a single-element array.');

    t.throws(
      () => arrayToError('a'),
      /TypeError.*a is not an array\. Expected an array of error messages\./,
      'should throw a type error when the first argument is not an array.'
    );

    t.throws(
      () => arrayToError([1]),
      /TypeError.*1 is not a string\. Expected every item in the array is an error message string\./,
      'should throw a type error when the first argument includes a non-string value.'
    );

    t.throws(
      () => arrayToError([1, false]),
      /TypeError.*1 and false are not strings\./,
      'should throw a type error when the first argument includes non-string values.'
    );

    t.throws(
      () => arrayToError(['a'], 12345),
      /12345 is not a function\. Expected an error constructor\./,
      'should throw a type error when the second argument is not a function.'
    );
  });
}

rollup({
  entry: require('./package.json')['jsnext:main'],
  plugins: rollupNodeResolve({jsnext: true})
}).then(bundle => {
  runTest(require('.'), 'require(\'array-to-error\')');
  runTest(global.window.arrayToError, 'window.arrayToError');
  runTest(requireFromString(bundle.generate({format: 'cjs'}).code), 'Module exports');
});
