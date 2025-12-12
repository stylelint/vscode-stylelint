/**
 * Makes all properties of type `T` optional except for those in `K`.
 */
export type OptionalExcept<T extends Record<never, never>, K extends keyof T> = Pick<T, K> &
	Partial<Pick<T, K>>;

/**
 * Makes all properties of type `T` required except for those in `K`.
 */
export type RequiredExcept<T extends Record<never, never>, K extends keyof T> = Pick<
	T,
	Exclude<keyof T, K>
> &
	Required<Pick<T, K>>;

/**
 * Extracts keys from a type `T` the values of which are type `V`.
 */
export type ExtractKeysOfValueType<T, V> = {
	[K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

/**
 * Given a function `T`, returns a function type with the same parameters, but
 * with the return type `Promise<R> | R` where `R` is the return type of `T`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MaybeAsync<T extends (...args: any[]) => any> = (
	...args: Parameters<T>
) => Promise<ReturnType<T>> | ReturnType<T>;

/**
 * Given a type `T`, returns a type with only the public properties of `T`.
 */
export type PublicOnly<T> = Pick<T, keyof T>;

/**
 * If the given type is an object, returns a type with its private members
 * removed. Otherwise, returns the type as-is.
 */
export type PublicOnlyIfObject<T> = T extends object ? PublicOnly<T> : T;

/**
 * Given a type `T`, returns a type with only the public properties of `T` and
 * its descendants.
 */
export type PublicOnlyDeep<T> = {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	[K in keyof T]: T[K] extends Function ? T[K] : T[K] extends object ? PublicOnlyDeep<T[K]> : T[K];
};
