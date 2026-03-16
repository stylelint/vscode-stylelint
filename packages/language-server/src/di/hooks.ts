import { Constructable, InjectionToken } from './inject.js';

const initializationHooksKey = Symbol('diInitializationHooks');

export interface InitializationHookContext<TInstance> {
	instance: TInstance;
	token: Constructable<TInstance>;
	dependencies: readonly unknown[];
	resolve<T>(token: InjectionToken<T>): T;
}

export type InitializationHook<TInstance> = (context: InitializationHookContext<TInstance>) => void;

type HookableConstructable<T> = Constructable<T> & {
	[initializationHooksKey]?: InitializationHook<T>[];
};

/**
 * Registers an initialization hook for a specific constructable type.
 */
export function registerInitializationHook<T>(
	target: Constructable<T>,
	hook: InitializationHook<T>,
): void {
	const hookableTarget = target as HookableConstructable<T>;

	if (hookableTarget[initializationHooksKey]) {
		hookableTarget[initializationHooksKey].push(hook);

		return;
	}

	Object.defineProperty(hookableTarget, initializationHooksKey, {
		value: [hook],
		writable: false,
		configurable: false,
		enumerable: false,
	});
}

/**
 * Retrieves the initialization hooks registered for a specific constructable type.
 */
export function getInitializationHooks<T>(
	target: Constructable<T>,
): readonly InitializationHook<T>[] {
	return ((target as HookableConstructable<T>)[initializationHooksKey] ??
		[]) as readonly InitializationHook<T>[];
}
