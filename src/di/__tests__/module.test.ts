import { describe, expect, test } from 'vitest';

import { inject } from '../inject.js';
import { module, provideValue } from '../module.js';
import { createToken } from '../tokens.js';

describe('module', () => {
	test('collects providers from imports and registrations', () => {
		const ValueToken = createToken<number>('value');
		const DerivedToken = createToken<string>('derived');

		@inject({ scope: 'transient', inject: [ValueToken] })
		class NeedsValue {
			public constructor(public readonly value: number) {}
		}

		const baseModule = module({
			register: [provideValue(ValueToken, () => 7)],
		});

		const featureModule = module({
			imports: [baseModule],
			register: [
				NeedsValue,
				{
					token: DerivedToken,
					inject: [ValueToken],
					scope: 'transient',
					useFactory: (value: number) => `value:${value}`,
				},
			],
		});

		const valueProvider = featureModule.providers.get(ValueToken);
		const classProvider = featureModule.providers.get(NeedsValue);
		const factoryProvider = featureModule.providers.get(DerivedToken);

		expect(valueProvider).toBeDefined();
		expect(classProvider).toBeDefined();
		expect(factoryProvider).toBeDefined();

		const nonNullValueProvider = valueProvider!;
		const nonNullClassProvider = classProvider!;
		const nonNullFactoryProvider = factoryProvider!;

		expect(nonNullValueProvider.create()).toBe(7);
		expect(nonNullClassProvider.scope).toBe('transient');
		const instance = nonNullClassProvider.create(7) as NeedsValue;

		expect(instance.value).toBe(7);
		expect(nonNullFactoryProvider.inject).toEqual([ValueToken]);
		expect(nonNullFactoryProvider.create(7)).toBe('value:7');
	});

	test('throws when registering a class without the inject decorator', () => {
		class Plain {}

		expect(() => module({ register: [Plain] })).toThrow(/@inject/);
	});

	test('throws when imported modules register the same token', () => {
		@inject()
		class Duplicate {}

		const first = module({ register: [Duplicate] });
		const second = module({ register: [Duplicate] });

		expect(() => module({ imports: [first, second] })).toThrow(
			/registered multiple times while importing modules/,
		);
	});

	test('throws when the same token is registered twice in a module call', () => {
		const DuplicateToken = createToken('duplicate');

		expect(() =>
			module({
				register: [
					provideValue(DuplicateToken, () => 'first'),
					provideValue(DuplicateToken, () => 'second'),
				],
			}),
		).toThrow(/registered multiple times in module/);
	});
});

describe('provideValue', () => {
	test('creates a factory registration without dependencies', () => {
		const Token = createToken<Date>('date-token');
		const factoryRegistration = provideValue(Token, () => new Date(2024, 0, 1));

		expect(factoryRegistration).toEqual({
			token: Token,
			useFactory: expect.any(Function),
		});

		const createdValue = factoryRegistration.useFactory();

		expect(createdValue).toBeInstanceOf(Date);
		expect(createdValue.getFullYear()).toBe(2024);
	});

	test('creates a factory registration with scope', () => {
		const Token = createToken<Date>('scoped-date-token');
		const factoryRegistration = provideValue(Token, () => new Date(2025, 0, 1), 'singleton');

		expect(factoryRegistration).toEqual({
			token: Token,
			useFactory: expect.any(Function),
			scope: 'singleton',
		});

		const createdValue = factoryRegistration.useFactory();

		expect(createdValue).toBeInstanceOf(Date);
		expect(createdValue.getFullYear()).toBe(2025);
	});
});
