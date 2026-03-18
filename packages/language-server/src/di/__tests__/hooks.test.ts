import { describe, expect, test, vi } from 'vitest';

import { getInitializationHooks, registerInitializationHook } from '../hooks.js';

describe('initialization hooks', () => {
	test('returns an empty array when no hooks are registered', () => {
		class Unregistered {}

		expect(getInitializationHooks(Unregistered)).toEqual([]);
	});

	test('registerInitializationHook stores hooks per class and preserves order', () => {
		class First {}
		class Second {}
		const firstHook = vi.fn();
		const secondHook = vi.fn();
		const otherHook = vi.fn();

		registerInitializationHook(First, firstHook);
		registerInitializationHook(First, secondHook);
		registerInitializationHook(Second, otherHook);

		expect(getInitializationHooks(First)).toEqual([firstHook, secondHook]);
		expect(getInitializationHooks(Second)).toEqual([otherHook]);
	});
});
