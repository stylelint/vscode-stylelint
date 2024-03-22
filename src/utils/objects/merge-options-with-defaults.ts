import rfdc from 'rfdc';
import { isObject } from './is-object';

const deepClone = rfdc();

type Circular<T extends object, V extends object = object> = [V, T, keyof T];

/**
 * Merges options with default values and returns a new object. Nested objects
 * are also merged. Properties not present in the defaults are not copied.
 */
function mergeOptionsWithDefaultsInner<T extends object>(
	options: unknown,
	defaults: T,
	seen: WeakSet<object>,
	mapped: WeakMap<object, unknown>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	circulars: Set<Circular<any>>,
): T {
	if (!isObject(options)) {
		return deepClone(defaults);
	}

	const result = {} as T;

	for (const key of Object.keys(defaults) as (keyof T)[]) {
		const fromDefaults = defaults[key];

		const fromOptions: unknown = options[key as keyof typeof options];

		if (fromOptions !== undefined) {
			if (isObject(fromOptions)) {
				if (seen.has(fromOptions)) {
					circulars.add([fromOptions, result, key]);

					continue;
				}

				seen.add(fromOptions);

				const value: unknown = Array.isArray(fromOptions)
					? fromOptions.map((item: unknown) => deepClone(item))
					: isObject(fromDefaults) && !Array.isArray(fromDefaults)
						? mergeOptionsWithDefaultsInner(fromOptions, fromDefaults, seen, mapped, circulars)
						: deepClone(fromOptions);

				mapped.set(fromOptions, value);

				result[key] = value as T[keyof T];

				continue;
			}

			result[key] = fromOptions as T[keyof T];

			continue;
		}

		result[key] = deepClone(fromDefaults);
	}

	return result;
}

/**
 * Merges options with default values and returns a new object. Nested objects
 * are also merged. Properties not present in the defaults are not copied.
 */
export function mergeOptionsWithDefaults<T extends object>(options: unknown, defaults: T): T {
	// Track references to avoid circular infinite recursion.
	const seen = new WeakSet<object>();
	const mapped = new WeakMap<object, [keyof T, T[keyof T]]>();
	const circulars = new Set<Circular<Record<string | number | symbol, unknown>>>();

	const result = mergeOptionsWithDefaultsInner(options, defaults, seen, mapped, circulars);

	for (const [circular, obj, key] of circulars) {
		obj[key] = mapped.get(circular);
	}

	return result;
}
