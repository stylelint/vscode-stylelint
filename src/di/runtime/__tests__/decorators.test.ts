import { describe, expect, test } from 'vitest';

import { runtimeService } from '../decorators.js';
import { runtimeServiceSymbol } from '../symbols.js';
import { isRuntimeServiceConstructor } from '../decorators.js';

describe('runtime decorators', () => {
	test('runtimeService marks constructors with the runtime symbol', () => {
		@runtimeService()
		class RuntimeReady {}

		expect(isRuntimeServiceConstructor(RuntimeReady)).toBe(true);

		const descriptor = Object.getOwnPropertyDescriptor(RuntimeReady, runtimeServiceSymbol);

		expect(descriptor).toMatchObject({
			value: true,
			configurable: false,
			enumerable: false,
			writable: false,
		});
	});

	test('isRuntimeServiceConstructor returns false when decorator is missing', () => {
		class PlainService {}

		expect(isRuntimeServiceConstructor(PlainService)).toBe(false);
	});

	test('runtimeService throws when used outside class declarations', () => {
		const decorator = runtimeService();
		const fakeContext = {
			kind: 'method',
			name: 'badUsage',
			static: false,
			private: false,
			access: {
				has() {
					return false;
				},
				get() {
					return () => undefined;
				},
				set() {
					return undefined;
				},
			},
			addInitializer() {
				return undefined;
			},
		} as unknown as ClassDecoratorContext;

		expect(() => decorator(class Named {}, fakeContext)).toThrow(
			'@runtimeService() can only be applied to classes.',
		);
	});
});
