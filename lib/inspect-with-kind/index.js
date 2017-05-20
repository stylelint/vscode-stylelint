/*!
 * inspect-with-kind | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/inspect-with-kind
*/
'use strict';

const inspect = require('util').inspect;

const kindOf = require('kind-of');

const appendedKinds = new Set([
  'boolean',
  'string',
  'number',
  'array',
  'regexp',
  'date',
  'arguments',
  'object'
]);

module.exports = function inspectWithKind(val, options) {
  const kind = kindOf(val);
  const stringifiedVal = inspect(val, Object.assign({
    breakLength: Infinity,
    maxArrayLength: 10
  }, options));

  if (kind === 'error') {
    return val.toString();
  }

  if (!appendedKinds.has(kind)) {
    return stringifiedVal;
  }

  if (stringifiedVal.startsWith('Observable {')) {
    return stringifiedVal;
  }

  return `${stringifiedVal} (${kind})`;
};
