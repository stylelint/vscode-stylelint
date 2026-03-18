import { describe, expect, test } from 'vitest';

import { runtimeServiceSymbol } from '../symbols.js';

describe('runtime symbols', () => {
	test('runtimeServiceSymbol carries the expected description', () => {
		expect(typeof runtimeServiceSymbol).toBe('symbol');
		expect(runtimeServiceSymbol.description).toBe('runtimeService');
	});
});
