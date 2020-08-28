# array-to-sentence

> 🚧 Inlined dependency taken from [https://github.com/shinnn/array-to-sentence](https://github.com/shinnn/array-to-sentence).

---

Join all elements of an array and create a human-readable string

```javascript
arrayToSentence(["foo", "bar", "baz", "qux"]); //=> 'foo, bar, baz and qux'
```

## Installation

[Use](https://docs.npmjs.com/cli/install) [npm](https://docs.npmjs.com/about-npm/).

```
npm install array-to-sentence
```

## API

```javascript
import arrayToSentence from "array-to-sentence";
```

### arrayToSentence(_array_ [, *options*])

_array_: `Array<any>`  
_options_: `Object`  
Return: `string`

It joins all elements of an array, and returns a string in the form `A, B, ... and X`.

```javascript
arrayToSentence(["one", "two", 3]); //=> 'one, two and 3'
arrayToSentence(["one", "two"]); //=> 'one and two'
arrayToSentence(["one"]); //=> 'one'

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
arrayToSentence(["A", "B", "C"], {
  separator: "-",
  lastSeparator: "-"
}); //=> 'A-B-C'

arrayToSentence(["Earth", "Wind", "Fire"], {
  lastSeparator: " & "
}); //=> 'Earth, Wind & Fire'
```
