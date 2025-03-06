import { mergeOptionsWithDefaults } from '../merge-options-with-defaults';

describe('mergeOptionsWithDefaults', () => {
	it('should merge options with defaults', () => {
		const options = {
			a: 1,
			b: '2',
			c: true,
			d: {
				e: undefined,
				g: [1, 2, 3],
				h: {
					i: null,
				},
				k: {
					l: 'l',
				},
			},
		};

		const defaults = {
			a: undefined as number | undefined,
			b: '1',
			c: false,
			d: {
				e: 'e',
				f: 'f',
				g: [4, 5, 6],
				h: {
					i: 'i' as string | null,
					j: 'j',
				},
				k: 'k' as string | { l: string },
			},
			k: Infinity,
		};

		const result = mergeOptionsWithDefaults(options, defaults);

		expect(result).toStrictEqual({
			a: 1,
			b: '2',
			c: true,
			d: {
				e: 'e',
				f: 'f',
				g: [1, 2, 3],
				h: {
					i: null,
					j: 'j',
				},
				k: {
					l: 'l',
				},
			},
			k: Infinity,
		});
	});

	it('for non-object options, should return cloned defaults', () => {
		const options = null;
		const defaults = {
			a: 1,
			b: '2',
			c: true,
			d: {
				e: undefined,
				g: [{ value: 1 }, { value: 2 }, { value: 3 }],
			},
		};

		const result = mergeOptionsWithDefaults(options, defaults);

		expect(result).toStrictEqual(defaults);
		expect(result).not.toBe(defaults);
		expect(result.d).not.toBe(defaults.d);
		expect(result.d.g).not.toBe(defaults.d.g);
		expect(result.d.g[0]).not.toBe(defaults.d.g[0]);
		expect(result.d.g[1]).not.toBe(defaults.d.g[1]);
		expect(result.d.g[2]).not.toBe(defaults.d.g[2]);
	});

	it('should clone properties from defaults', () => {
		const options = {
			a: 1,
			b: '2',
			c: true,
		};

		const defaults = {
			a: undefined as number | undefined,
			b: '1',
			c: false,
			d: {
				e: 'e',
				f: 'f',
				g: [{ value: 1 }, { value: 2 }, { value: 3 }],
				h: {
					i: 'i' as string | null,
					j: 'j',
				},
			},
			k: Infinity,
		};

		const result = mergeOptionsWithDefaults(options, defaults);

		expect(result).toStrictEqual({
			a: 1,
			b: '2',
			c: true,
			d: {
				e: 'e',
				f: 'f',
				g: [{ value: 1 }, { value: 2 }, { value: 3 }],
				h: {
					i: 'i',
					j: 'j',
				},
			},
			k: Infinity,
		});
		expect(result.d).not.toBe(defaults.d);
		expect(result.d.g).not.toBe(defaults.d.g);
		expect(result.d.g[0]).not.toBe(defaults.d.g[0]);
		expect(result.d.g[1]).not.toBe(defaults.d.g[1]);
		expect(result.d.g[2]).not.toBe(defaults.d.g[2]);
		expect(result.d.h).not.toBe(defaults.d.h);
	});

	it('with circular references, should not infinitely recurse', () => {
		type CircularOptions = {
			a?: number;
			b: {
				c: number;
				d?: CircularOptions;
			};
		};

		const options: CircularOptions = {
			a: 4,
			b: {
				c: 1,
				d: undefined,
			},
		};

		options.b.d = options;

		const defaults = {
			a: 1,
			b: {
				c: 2,
				d: {
					a: 3,
					b: undefined,
				},
			},
		};

		const result = mergeOptionsWithDefaults(options, defaults);

		expect(result).toMatchSnapshot();
	});

	it('should not merge properties on arrays', () => {
		const options = {
			a: [4, 5, 6],
		};

		const defaults = {
			a: Object.assign([1, 2, 3], { a: 'a', b: 'b' }) as number[] & {
				a?: string;
				b?: string;
			},
		};

		const result = mergeOptionsWithDefaults(options, defaults);

		expect(result).toStrictEqual({
			a: [4, 5, 6],
		});
		expect(result.a).not.toHaveProperty('a');
		expect(result.a).not.toHaveProperty('b');
	});
});
