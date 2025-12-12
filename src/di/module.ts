import { PublicOnlyIfObject } from '../server/utils/types.js';
import { Constructable, getInjectMetadata, InjectionToken, Scope } from './inject.js';

export interface FactoryRegistration<T = unknown, Deps extends readonly unknown[] = []> {
	token: InjectionToken<T>;
	useFactory: (...deps: Deps) => PublicOnlyIfObject<T>;
	inject?: InjectionToken[];
	scope?: Scope;
}

// Any type is used since otherwise there will be conflicts with dependency types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModuleRegistryEntry<T = unknown, D extends readonly unknown[] = any[]> =
	| Constructable<T>
	| FactoryRegistration<T, D>;

export interface ModuleOptions {
	imports?: ModuleMetadata[];
	register?: ModuleRegistryEntry[];
}

export interface ProviderDefinition<T = unknown> {
	token: InjectionToken<T>;
	scope: Scope;
	inject: InjectionToken[];
	create: (...deps: unknown[]) => T;
}

export interface ModuleMetadata {
	providers: Map<InjectionToken<unknown>, ProviderDefinition>;
}

/**
 * Describes an injection token for error messages.
 */
function describeToken(token: InjectionToken<unknown>): string {
	if (typeof token === 'function') {
		return token.name || '<anonymous class>';
	}

	return token.description ?? token.toString();
}

/**
 * Creates a provider definition for a class constructor.
 */
function createClassProvider(ctor: Constructable<unknown>): ProviderDefinition {
	const injectMetadata = getInjectMetadata(ctor);

	if (!injectMetadata) {
		throw new Error(
			`Class ${ctor.name || '<anonymous>'} must be decorated with @inject to be registered`,
		);
	}

	const concreteCtor = ctor as unknown as new (...args: unknown[]) => unknown;

	return {
		token: ctor,
		scope: injectMetadata.scope,
		inject: [...injectMetadata.inject],
		create: (...deps) => new concreteCtor(...deps),
	};
}

/**
 * Creates a provider definition for a factory function.
 */
function createFactoryProvider<T, Deps extends readonly unknown[]>(
	entry: FactoryRegistration<T, Deps>,
): ProviderDefinition<T> {
	return {
		token: entry.token,
		scope: entry.scope ?? 'singleton',
		inject: entry.inject ? [...entry.inject] : [],
		create: (...deps) => entry.useFactory(...(deps as unknown as Deps)),
	};
}

/**
 * Creates metadata for a dependency injection module.
 *
 * @example
 * ```ts
 * const myModule = module({
 *   register: [
 *     MyClass,
 *     { token: myToken, useFactory: () => new Dependency() },
 *     {
 *       token: otherToken,
 *       useFactory: (MyClass) => ...,
 *       inject: [MyClass],
 *     },
 *   ],
 * });
 * ```
 * @param options Module options.
 */
export function module(options: ModuleOptions = {}): ModuleMetadata {
	const providers = new Map<InjectionToken<unknown>, ProviderDefinition>();

	if (options.imports) {
		for (const importedModule of options.imports) {
			for (const [token, definition] of importedModule.providers) {
				if (providers.has(token)) {
					throw new Error(
						`Token ${describeToken(token)} registered multiple times while importing modules`,
					);
				}

				providers.set(token, definition);
			}
		}
	}

	if (options.register) {
		for (const entry of options.register) {
			const provider =
				typeof entry === 'function' ? createClassProvider(entry) : createFactoryProvider(entry);

			if (providers.has(provider.token)) {
				throw new Error(
					`Token ${describeToken(provider.token)} registered multiple times in module()`,
				);
			}

			providers.set(provider.token, provider);
		}
	}

	return { providers };
}

/**
 * Shorthand to create a factory registration that does not require dependencies.
 */
export function provideValue<T>(
	token: InjectionToken<T>,
	factory: () => PublicOnlyIfObject<T>,
	scope?: Scope,
): FactoryRegistration<T> {
	return (
		scope ? { token, useFactory: factory, scope } : { token, useFactory: factory }
	) as FactoryRegistration<T>;
}

/**
 * Shorthand to create a factory registration that does not require dependencies.
 * Allows providing a partial implementation of an object type.
 */
export function provideTestValue<T>(
	token: InjectionToken<T>,
	factory: () => Partial<PublicOnlyIfObject<T>>,
	scope?: Scope,
): FactoryRegistration<T> {
	return (
		scope ? { token, useFactory: factory, scope } : { token, useFactory: factory }
	) as FactoryRegistration<T>;
}
