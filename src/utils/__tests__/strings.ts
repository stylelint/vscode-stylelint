import { padNumber, padString, upperCaseFirstChar } from '../strings';

describe('padNumber', () => {
	test('should pad a number with leading zeros', () => {
		expect(padNumber(1, 3)).toBe('001');
		expect(padNumber(10, 3)).toBe('010');
		expect(padNumber(100, 3)).toBe('100');
	});

	test('should throw an error if the length is 0 or less', () => {
		expect(() => padNumber(1, 0)).toThrow();
		expect(() => padNumber(1, -1)).toThrow();
	});
});

describe('padString', () => {
	test('should pad a string with spaces', () => {
		expect(padString('foo', 3)).toBe('foo');
		expect(padString('foo', 5)).toBe('foo  ');
	});

	test('should throw an error if the length is 0 or less', () => {
		expect(() => padString('foo', 0)).toThrow();
		expect(() => padString('foo', -1)).toThrow();
	});
});

describe('upperCaseFirstChar', () => {
	test('should uppercase the first character of a string', () => {
		expect(upperCaseFirstChar('foo')).toBe('Foo');
		expect(upperCaseFirstChar('Foo')).toBe('Foo');
		expect(upperCaseFirstChar('foo bar')).toBe('Foo bar');
		expect(upperCaseFirstChar('Foo Bar')).toBe('Foo Bar');
	});
});
