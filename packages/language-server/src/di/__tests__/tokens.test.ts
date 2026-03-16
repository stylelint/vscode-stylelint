import { describe, expect, test } from 'vitest';

import { createToken } from '../tokens.js';

describe('tokens', () => {
	test('createToken yields descriptive unique symbols', () => {
		const first = createToken<number>('TokenDescription');
		const second = createToken<number>('TokenDescription');

		expect(typeof first).toBe('symbol');
		expect(first).not.toBe(second);
		expect(first.toString()).toContain('TokenDescription');
	});
});
