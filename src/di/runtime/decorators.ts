import type { Constructable } from '../inject.js';
import type { ClassDecoratorFunction } from '../types.js';
import { runtimeServiceSymbol } from './symbols.js';

export type RuntimeServiceConstructor = Constructable<unknown> & {
	[runtimeServiceSymbol]: true;
};

/**
 * Marks a class as a runtime service to be registered automatically.
 */
export function runtimeService(): ClassDecoratorFunction {
	// Function type used to match decorator signature.
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	return (target: Function, { kind }: ClassDecoratorContext) => {
		if (kind !== 'class') {
			throw new Error('@runtimeService() can only be applied to classes.');
		}

		Object.defineProperty(target, runtimeServiceSymbol, {
			value: true,
			writable: false,
			configurable: false,
			enumerable: false,
		});
	};
}

/**
 * Determines if a class is marked as a runtime service.
 */
export function isRuntimeServiceConstructor(
	target: Constructable<unknown>,
): target is RuntimeServiceConstructor {
	return Boolean((target as { [runtimeServiceSymbol]?: true })[runtimeServiceSymbol]);
}
