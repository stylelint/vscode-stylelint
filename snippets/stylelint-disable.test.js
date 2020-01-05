'use strict';

const snippets = require('./stylelint-disable.json');

const unique = xs => [...new Set(xs)];

describe('Snippets', () => {
	const keys = Object.keys(snippets);

	it('should not be empty', () => {
		expect(keys.length).toBeGreaterThan(0);
	});

	it('is sorted by key', () => {
		const sortedKeys = [...keys].sort();

		expect(keys).toEqual(sortedKeys);
	});

	it("has unique prefixes", () => {
		const prefixes = Object.values(snippets).map(x => x.prefix);

		expect(prefixes).toEqual(unique(prefixes));
	});

	describe.each(keys)('%s', (key) => {
		it('should have a prefix', () => {
			const {
				prefix
			} = snippets[key];

			expect(prefix).toBeDefined();
			expect(prefix.length).toBeGreaterThan(0);
			expect(prefix.startsWith('stylelint-disable')).toBe(true);
		});

		it('should have a body', () => {
			const {
				body
			} = snippets[key];

			expect(body).toBeDefined();
			expect(body.length).toBeGreaterThan(0);
		});

		it('should have a description', () => {
			const {
				description
			} = snippets[key];

			expect(description).toBeDefined();
			expect(description.length).toBeGreaterThan(0);
		});
	});
});
