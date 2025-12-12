import { describe, expect, test, vi } from 'vitest';

import { createContainer } from '../container.js';
import { registerInitializationHook } from '../hooks.js';
import { inject } from '../inject.js';
import { module, provideValue } from '../module.js';
import { createToken } from '../tokens.js';

describe('dependency injection container', () => {
	test('resolves singleton factory registrations by default', () => {
		const SingletonToken = createToken<{ id: number }>('Singleton');
		const diModule = module({
			register: [provideValue(SingletonToken, () => ({ id: Math.random() }))],
		});
		const container = createContainer(diModule);
		const first = container.resolve(SingletonToken);
		const second = container.resolve(SingletonToken);

		expect(first).toBe(second);
	});

	test('creates new instances for transient factories', () => {
		const TransientToken = createToken<{ createdAt: number }>('Transient');
		const diModule = module({
			register: [provideValue(TransientToken, () => ({ createdAt: Date.now() }), 'transient')],
		});
		const container = createContainer(diModule);

		expect(container.resolve(TransientToken)).not.toBe(container.resolve(TransientToken));
	});

	test('injects dependencies into classes via decorators', () => {
		const ValueToken = createToken<number>('Value');

		@inject({ inject: [ValueToken] })
		class NeedsValue {
			public constructor(public readonly value: number) {}
		}

		const diModule = module({
			register: [provideValue(ValueToken, () => 42), NeedsValue],
		});

		const container = createContainer(diModule);

		expect(container.resolve(NeedsValue).value).toBe(42);
		expect(container.resolve(NeedsValue)).toBe(container.resolve(NeedsValue));
	});

	test('allows overrides when constructing the container', () => {
		const OverridableToken = createToken<string>('Overridable');
		const diModule = module({
			register: [provideValue(OverridableToken, () => 'default')],
		});

		const container = createContainer(diModule, {
			overrides: [[OverridableToken, 'override']],
		});

		expect(container.resolve(OverridableToken)).toBe('override');
	});

	test('throws when no provider is registered for a token', () => {
		const MissingToken = createToken('Missing');
		const container = createContainer(module());

		expect(() => container.resolve(MissingToken)).toThrow(/No provider/);
	});

	test('detects circular dependencies between providers', () => {
		const FirstToken = createToken<number>('First');
		const SecondToken = createToken<number>('Second');

		const diModule = module({
			register: [
				{
					token: FirstToken,
					inject: [SecondToken],
					useFactory: (second: number) => second + 1,
				},
				{
					token: SecondToken,
					inject: [FirstToken],
					useFactory: (first: number) => first + 1,
				},
			],
		});
		const container = createContainer(diModule);

		expect(() => container.resolve(FirstToken)).toThrow(/Circular dependency/);
	});

	test('supports module imports for composition', () => {
		const BaseToken = createToken<string>('Base');

		@inject({ inject: [BaseToken] })
		class UsesBase {
			public constructor(public readonly base: string) {}
		}

		const baseModule = module({
			register: [provideValue(BaseToken, () => 'from-base')],
		});

		const featureModule = module({
			imports: [baseModule],
			register: [UsesBase],
		});

		const container = createContainer(featureModule);

		expect(container.resolve(UsesBase).base).toBe('from-base');
	});

	test('invokes registered initialization hooks for class providers', () => {
		const ValueToken = createToken<number>('hook-value');
		const hook = vi.fn();

		@inject({ inject: [ValueToken], scope: 'transient' })
		class HookedService {
			public constructor(public readonly value: number) {}
		}

		registerInitializationHook(HookedService, hook);

		const diModule = module({
			register: [provideValue(ValueToken, () => 64), HookedService],
		});

		const container = createContainer(diModule);
		const instance = container.resolve(HookedService);

		expect(hook).toHaveBeenCalledTimes(1);
		expect(hook).toHaveBeenCalledWith(
			expect.objectContaining({
				instance,
				token: HookedService,
				dependencies: [64],
			}),
		);
		expect(hook.mock.calls[0][0].resolve(ValueToken)).toBe(64);
	});

	test('throws when tokens collide across separate modules passed to createContainer', () => {
		const DuplicateToken = createToken('duplicate-token');
		const firstModule = module({
			register: [provideValue(DuplicateToken, () => 'first')],
		});
		const secondModule = module({
			register: [provideValue(DuplicateToken, () => 'second')],
		});

		expect(() => createContainer([firstModule, secondModule])).toThrow(
			/multiple times across modules/,
		);
	});
});
