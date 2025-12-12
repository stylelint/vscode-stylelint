import { Constructable, InjectionToken } from './inject.js';
import { ModuleMetadata, ProviderDefinition } from './module.js';
import { getInitializationHooks } from './hooks.js';

export interface CreateContainerOptions {
	overrides?: Iterable<[InjectionToken<unknown>, unknown]>;
}

export interface Container {
	resolve<T>(token: InjectionToken<T>): T;
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
 * Merges provider definitions from multiple modules into a single map.
 */
function mergeProviders(
	modules: ModuleMetadata | ModuleMetadata[],
): Map<InjectionToken<unknown>, ProviderDefinition> {
	const merged = new Map<InjectionToken<unknown>, ProviderDefinition>();
	const moduleList = Array.isArray(modules) ? modules : [modules];

	for (const moduleMetadata of moduleList) {
		for (const [token, definition] of moduleMetadata.providers) {
			if (merged.has(token)) {
				throw new Error(`Token ${describeToken(token)} registered multiple times across modules`);
			}

			merged.set(token, definition);
		}
	}

	return merged;
}

/**
 * Creates a dependency injection container from the provided modules.
 */
export function createContainer(
	modules: ModuleMetadata | ModuleMetadata[],
	options: CreateContainerOptions = {},
): Container {
	const mergedProviders = mergeProviders(modules);
	const overrides = new Map<InjectionToken<unknown>, unknown>(options.overrides ?? []);
	const singletons = new Map<InjectionToken<unknown>, unknown>();
	const resolutionStack: InjectionToken<unknown>[] = [];

	const resolve = <T>(token: InjectionToken<T>): T => {
		if (overrides.has(token)) {
			return overrides.get(token) as T;
		}

		if (singletons.has(token)) {
			return singletons.get(token) as T;
		}

		const provider = mergedProviders.get(token);

		if (!provider) {
			throw new Error(`No provider found for ${describeToken(token)}`);
		}

		if (resolutionStack.includes(token)) {
			const cycle = [...resolutionStack, token].map(describeToken).join(' -> ');

			throw new Error(`Circular dependency detected: ${cycle}`);
		}

		resolutionStack.push(token);

		try {
			const dependencies = provider.inject.map((dependencyToken) => resolve(dependencyToken));
			const instance = provider.create(...dependencies);

			if (typeof token === 'function') {
				const hooks = getInitializationHooks(token as Constructable<unknown>);

				for (const hook of hooks) {
					hook({
						instance,
						token: token as Constructable<unknown>,
						dependencies,
						resolve,
					});
				}
			}

			if (provider.scope === 'singleton') {
				singletons.set(token, instance);
			}

			return instance as T;
		} finally {
			resolutionStack.pop();
		}
	};

	return { resolve };
}
