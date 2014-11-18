# array-to-sentence

[![NPM version](https://badge.fury.io/js/array-to-sentence.svg)](https://www.npmjs.org/package/array-to-sentence)
[![Bower version](https://badge.fury.io/bo/array-to-sentence.svg)](https://github.com/shinnn/array-to-sentence/releases)
[![Build Status](https://travis-ci.org/shinnn/array-to-sentence.svg?branch=master)](https://travis-ci.org/shinnn/array-to-sentence)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/array-to-sentence.svg)](https://coveralls.io/r/shinnn/array-to-sentence)
[![devDependency Status](https://david-dm.org/shinnn/array-to-sentence/dev-status.svg)](https://david-dm.org/shinnn/array-to-sentence#info=devDependencies)

Join all elements of an array and create a human-readable string

```javascript
arrayToSentence(['foo', 'bar', 'baz', 'qux']); //=> 'foo, bar, baz and qux'
```

## Installation

### Package managers

#### [npm](https://www.npmjs.org/)

```sh
npm install array-to-sentence
```

#### [bower](http://bower.io/)

```sh
bower install array-to-sentence
```

#### [Duo](http://duojs.org/)

```javascript
var arrayToSentence = require('shinnn/array-to-sentence');
```

### Standalone

[Download the script file directly.](https://raw.githubusercontent.com/shinnn/array-to-sentence/master/array-to-sentence.js)

## API

### arrayToSentence(*array* [, *options*])

*array*: `Array` of any values  
*options*: `Object`  
Return: `Array`

It joins all elements of an array, and returns a string in the form `A, B, ... and X`.

*Note that it doesn't support [serial comma](http://wikipedia.org/wiki/Serial_comma).*

```javascript
arrayToSentence(['one', 'two', 3]); //=> 'one, two and 3'
arrayToSentence(['one', 'two']); //=> 'one and two'
arrayToSentence(['one']); //=> 'one'
```

It returns an empty string if the array is empty.

```javascript
arrayToSentence([]); //=> ''
```

### options.separator

Type: `String`  
Default: `', '`

Set the separator string of each word.

### options.lastSeparator

Type: `String`  
Default: `' and '`

Set the separator string before the last word.

```javascript
arrayToSentence(['A', 'B', 'C'], {
  separator: '-',
  lastSeparator: '-'
}); //=> 'A-B-C'

arrayToSentence(['Earth', 'Wind', 'Fire'], {
  lastSeparator: ' & '
}); //=> 'Earth, Wind & Fire'
```

## Acknowledgement

For designing API, I used `.toSentence()` method of [underscore.string](https://github.com/epeli/underscore.string) as reference. Thanks, [Esa-Matti Suuronen](https://github.com/epeli) and [the contributors](https://github.com/epeli/underscore.string/graphs/contributors).

## License

Copyright (c) 2014 [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).
