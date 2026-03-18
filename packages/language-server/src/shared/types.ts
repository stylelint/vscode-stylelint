// @no-unit-test -- Type definitions only.

/**
 * Given a type `T`, returns a type with only the public properties of `T`.
 */
export type PublicOnly<T> = Pick<T, keyof T>;

/**
 * If the given type is an object, returns a type with its private members
 * removed. Otherwise, returns the type as-is.
 */
export type PublicOnlyIfObject<T> = T extends object ? PublicOnly<T> : T;
