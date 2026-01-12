import { ClassDecoratorFunction } from './types.js';
import { Token } from './tokens.js';

export type Scope = 'singleton' | 'transient';

// Any type is used since otherwise there will be conflicts with constructor signatures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructable<T> = abstract new (...args: any[]) => T;

export interface InjectMetadata {
	scope: Scope;
	inject: InjectionToken[];
}

type InjectionTokenTuple<TParameters extends unknown[]> = TParameters extends []
	? []
	: TParameters extends [infer Head, ...infer Tail]
		? [InjectionToken<Head>, ...InjectionTokenTuple<Tail>]
		: InjectionToken<TParameters[number]>[];

// Any type is used since otherwise there will be conflicts with constructor signatures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface InjectOptions<T extends Constructable<any>> {
	scope?: Scope;
	inject?: InjectionTokenTuple<ConstructorParameters<T>>;
}

export type InjectFunction<T> = Constructable<T> & {
	__injectMetadata__: InjectMetadata;
};

export type InjectionToken<T = unknown> = Token<T> | Constructable<T>;

export type ResolvedToken<TToken extends InjectionToken> =
	TToken extends Token<infer R> ? R : TToken extends Constructable<infer R> ? R : never;

export type ResolvedTokens<TTokens extends readonly InjectionToken[]> = {
	[Index in keyof TTokens]: TTokens[Index] extends InjectionToken<infer R> ? R : never;
};

/**
 * Determines if a function has injection metadata.
 */
function isInjectFunction<T>(func: Constructable<T>): func is InjectFunction<T> {
	return '__injectMetadata__' in func;
}

/**
 * Indicates that a class has dependencies to be injected by the DI container.
 *
 * @example
 * ```ts
 * @inject({
 *   scope: 'singleton',
 *   inject: [
 *     ClassDependency,
 *     dependencyToken,
 *   ],
 * })
 * class MyClass {
 *   constructor(
 *     classDep: ClassDependency,
 *     dependency: DependencyType,
 *   ) {
 *     // ...
 *   }
 * }
 */
// Any type is used since otherwise there will be conflicts with constructor signatures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function inject<T extends new (...args: any[]) => any>(
	options: InjectOptions<T> = {},
): ClassDecoratorFunction<T> {
	// Function type is required for decorators.
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	return function InjectDecorator(target: Function): void {
		const injectMetadata: InjectMetadata = {
			scope: options.scope ?? 'singleton',
			inject: (options.inject ?? []) as InjectionToken[],
		};

		Object.defineProperty(target, '__injectMetadata__', {
			value: injectMetadata,
			enumerable: false,
			configurable: false,
			writable: false,
		});
	};
}

/**
 * Retrieves injection metadata from a class, if available.
 */
export function getInjectMetadata<T>(func: Constructable<T>): InjectMetadata | undefined {
	if (isInjectFunction(func)) {
		return func.__injectMetadata__;
	}

	return undefined;
}
