# array-to-error

[![NPM version](https://img.shields.io/npm/v/array-to-error.svg)](https://www.npmjs.com/package/array-to-error)
[![Build Status](https://travis-ci.org/shinnn/array-to-error.svg?branch=master)](https://travis-ci.org/shinnn/array-to-error)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/array-to-error.svg)](https://coveralls.io/github/shinnn/array-to-error?branch=master)
[![Dependency Status](https://david-dm.org/shinnn/array-to-error.svg)](https://david-dm.org/shinnn/array-to-error)
[![Dependency Status](https://david-dm.org/shinnn/array-to-error.svg)](https://david-dm.org/shinnn/array-to-error)

Create an error instance from an array of error messages

```javascript
const arrayToError = require('array-to-error');

const error = arrayToError(['tranling comma on line 1', 'unexpected "(" on line 2']);
error.message; //=> 'tranling comma on line 1\nunexpected "(" on line 2'
error.reasons; //=> ['tranling comma on line 1', 'unexpected "(" on line 2']
```

## Installation

[Use npm.](https://docs.npmjs.com/cli/install)

```
npm install array-to-error
```

## API

```javascript
const arrayToError = require('array-to-error');
```

### arrayToError(*messages* [, *constructor*])

*messages*: `Array` of strings  
*constructor*: `Object` (One of the [error constructors](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types). [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error) by default)  
Return: `Object` (error instance)

It returns an instance of error whose `message` is made from its first argument joined with `\n`, and has an additional `reasons` property, the same value as its first argument.

The second argument is used as an error constructor.

```javascript
const arrayToError = require('array-to-error');

const error = arrayToError(['foo', 'bar'], TypeError);
error.message; //=> 'foo\nbar'
error.reasons; //=> ['foo', 'bar']
error.constructor; //=> TypeError
```

## License

Copyright (c) 2015 [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).
