import { mergeAssign } from '../merge-assign';

describe('mergeAssign', () => {
	it('should return an object', () => {
		expect(mergeAssign({}, {})).toBeInstanceOf(Object);
	});

	it('for two objects, should return their union', () => {
		const obj1 = { a: 1, b: { c: 2, d: { e: 3 } } };
		const obj2 = { a: undefined, b: { c: 3, d: { f: 4 } }, g: 5 };

		expect(mergeAssign(obj1, obj2)).toStrictEqual({
			a: undefined,
			b: {
				c: 3,
				d: {
					e: 3,
					f: 4,
				},
			},
			g: 5,
		});
	});

	it('for three objects, should return their union', () => {
		const obj1 = { a: 1, b: { c: 2, d: { e: 3 } } };
		const obj2 = { a: undefined, b: { c: 3, d: { f: 4 } }, g: 5 };
		const obj3 = { b: { d: { g: 6 } }, h: 7 };

		expect(mergeAssign(obj1, obj2, obj3)).toStrictEqual({
			a: undefined,
			b: {
				c: 3,
				d: {
					e: 3,
					f: 4,
					g: 6,
				},
			},
			g: 5,
			h: 7,
		});
	});

	it('should ignore undefined parameters', () => {
		expect(mergeAssign({ a: 1 }, undefined, undefined)).toStrictEqual({ a: 1 });
	});

	it('should merge arrays', () => {
		const obj1 = { a: 1, b: [1, 2, 3] };
		const obj2 = { a: 2, b: [4, 5, 6] };

		expect(mergeAssign(obj1, obj2)).toStrictEqual({ a: 2, b: [1, 2, 3, 4, 5, 6] });
	});

	it('should combine objects with dissimilar properties', () => {
		const obj1 = { a: 1, b: { c: 2, d: { e: 3 } } };
		const obj2 = { a: 2, b: { e: 3, f: { g: [4] } }, h: 5 };

		expect(mergeAssign(obj1, obj2)).toStrictEqual({
			a: 2,
			b: {
				c: 2,
				d: {
					e: 3,
				},
				e: 3,
				f: {
					g: [4],
				},
			},
			h: 5,
		});
	});

	it("shouldn't merge prototype or constructor properties", () => {
		const obj1 = {
			a: 2,
		};
		const obj2 = {
			__proto__: { a: 1 },
			constructor: Object.assign(() => undefined, { a: 1 }),
			b: 3,
		};

		expect(mergeAssign(obj1, obj2)).toStrictEqual({
			a: 2,
			b: 3,
		});
	});
});
