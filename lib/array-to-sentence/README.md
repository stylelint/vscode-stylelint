# array-to-sentence

[![npm version](https://img.shields.io/npm/v/array-to-sentence.svg)](https://www.npmjs.com/package/array-to-sentence)
[![Build Status](https://travis-ci.org/shinnn/array-to-sentence.svg?branch=master)](https://travis-ci.org/shinnn/array-to-sentence)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/array-to-sentence.svg)](https://coveralls.io/github/shinnn/array-to-sentence)

Join all elements of an array and create a human-readable string

```javascript
arrayToSentence(['foo', 'bar', 'baz', 'qux']); //=> 'foo, bar, baz and qux'
```

## Installation

#### [npm](https://www.npmjs.com/)

```
npm install array-to-sentence
```

## API

```js
import arrayToSentence from 'array-to-sentence';
```

### arrayToSentence(*array* [, *options*])

*array*: `Array<any>`  
*options*: `Object`  
Return: `string`

It joins all elements of an array, and returns a string in the form `A, B, ... and X`.

```javascript
arrayToSentence(['one', 'two', 3]); //=> 'one, two and 3'
arrayToSentence(['one', 'two']); //=> 'one and two'
arrayToSentence(['one']); //=> 'one'

arrayToSentence([]); //=> ''
```

### options.separator

Type: `string`  
Default: `', '`

Set the separator string of each word.

### options.lastSeparator

Type: `string`  
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

I used [`.toSentence()` method](https://epeli.github.io/underscore.string/#tosentence-array-delimiter-lastdelimiter-gt-string) of [underscore.string](https://github.com/epeli/underscore.string) as API design reference. Thanks, [Esa-Matti Suuronen](https://github.com/epeli) and [the contributors](https://github.com/epeli/underscore.string/graphs/contributors).

## License

[ISC License](./LICENSE) © 2018 Shinnosuke Watanabe
