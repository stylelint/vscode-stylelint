/*!
 * array-to-sentence | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/array-to-sentence
*/

module.exports = function arrayToSentence(arr, options) {
  'use strict';

  if (!Array.isArray(arr)) {
    throw new TypeError('First argument must be an array.');
  }

  if (arr.length === 0) {
    return '';
  }

  options = options || {};

  function validateOption(name) {
    if (typeof options[name] !== 'string') {
      throw new TypeError('`' + name + '` option must be a string.');
    }
  }

  if (options.separator === undefined) {
    options.separator = ', ';
  } else {
    validateOption('separator');
  }

  if (options.lastSeparator === undefined) {
    options.lastSeparator = ' and ';
  } else {
    validateOption('lastSeparator');
  }

  if (arr.length === 1) {
    return arr[arr.length - 1];
  }

  return arr.slice(0, -1).join(options.separator) + options.lastSeparator + arr[arr.length - 1];
};
