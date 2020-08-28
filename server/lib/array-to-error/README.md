# array-to-error

> 🚧 Inlined dependency taken from [https://github.com/shinnn/array-to-error](https://github.com/shinnn/array-to-error).

---

Create an error from an array of error messages

```javascript
const arrayToError = require("array-to-error");

const error = arrayToError([
  "tranling comma on line 1",
  'unexpected "(" on line 2'
]);
error.message; //=> 'tranling comma on line 1\nunexpected "(" on line 2'
error.reasons; //=> ['tranling comma on line 1', 'unexpected "(" on line 2']
```

## Installation

#### [npm](https://www.npmjs.com/)

```
npm install array-to-error
```

#### [Bower](https://bower.io/)

```
bower install array-to-error
```

## API

```javascript
const arrayToError = require("array-to-error");
```

### arrayToError(_messages_ [, *constructor*])

_messages_: `Array` of strings  
_constructor_: `Object` (One of the [error constructors](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types). [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error) by default)  
Return: `Object` (error instance)

It returns an instance of error whose `message` is made from its first argument joined with `\n`, and has an additional `reasons` property, the same value as its first argument.

The second argument is used as an error constructor.

```javascript
const arrayToError = require("array-to-error");

const error = arrayToError(["foo", "bar"], TypeError);
error.message; //=> 'foo\nbar'
error.reasons; //=> ['foo', 'bar']
error.constructor; //=> TypeError
```
