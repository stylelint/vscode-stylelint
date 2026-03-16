/**
 * A class decorator function.
 */
export type ClassDecoratorFunction<
	// Any type is used since otherwise there will be conflicts with constructor signatures.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	TFunction extends new (...args: any[]) => any = new (...args: any[]) => any,
> = (target: TFunction, context: ClassDecoratorContext) => void | TFunction;

/**
 * A method decorator function.
 */
// Function type used to match decorator signature.
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export type MethodDecoratorFunction<TFunction extends Function = Function> = (
	target: TFunction,
	context: ClassMethodDecoratorContext,
) => void | TFunction;

type ParameterPrefixTuples<
	TParameters extends readonly unknown[],
	TPrefix extends readonly unknown[] = [],
> = TParameters extends readonly [infer Head, ...infer Tail]
	? TPrefix | ParameterPrefixTuples<Tail, [...TPrefix, Head]>
	: TPrefix;

/**
 * A function type that can accept any prefix of the parameters of `TFunction`
 * while preserving its return type.
 */
// Any type is used since otherwise there will be conflicts with method signatures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CompatibleMethod<TFunction extends (...args: any[]) => any> =
	ParameterPrefixTuples<Parameters<TFunction>> extends infer TPrefixes
		? TPrefixes extends readonly unknown[]
			? (...args: TPrefixes) => ReturnType<TFunction>
			: never
		: never;

// Any type is used since otherwise there will be conflicts with method signatures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CompatibleMethodDecorator<TFunction extends (...args: any[]) => any> = <
	TCompatible extends CompatibleMethod<TFunction>,
>(
	target: TCompatible,
	context: ClassMethodDecoratorContext,
) => void | TCompatible;
