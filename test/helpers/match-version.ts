import semver from 'semver';
import { version as stylelintVersion } from 'stylelint/package.json';

/**
 * A mapping of semver version ranges to values of type T, with an optional
 * default value.
 */
export type MatchBlock<T, HasDefault = never> = {
	[versionRange: string]: T;
} & (HasDefault extends never ? object : { default: T });

/**
 * Returns the first value from `matches` where the key semver-satisfies
 * the current Stylelint version.
 *
 * @param matches An object where keys are semver version ranges and values are
 * of type T.
 * @returns The matched value of type T, or undefined if no match is found.
 */
export function matchVersion<T>(matches: MatchBlock<T>): T | undefined;
/**
 * Returns the first value from `matches` where the key semver-satisfies
 * the current Stylelint version, or the `default` value if no match is found.
 *
 * @param matches An object where keys are semver version ranges and values are
 * of type T, plus a `default` key.
 * @returns The matched value of type T, or the `default` value.
 */
export function matchVersion<T>(matches: MatchBlock<T, true>): T;
export function matchVersion<T, TDefault>(matches: MatchBlock<T, TDefault>): T | undefined {
	const { default: defaultValue, ...rest } = matches;

	for (const [versionRange, value] of Object.entries(rest)) {
		if (semver.satisfies(stylelintVersion, versionRange, { includePrerelease: true })) {
			return value;
		}
	}

	if ('default' in matches) {
		return defaultValue;
	}

	return undefined;
}
