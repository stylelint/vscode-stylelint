import semver from 'semver';
import { version as stylelintVersion } from 'stylelint/package.json';
import { describe, SuiteFactory, test, TestFunction } from 'vitest';

export function testOnVersion(
	versionRange: string,
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	name: string | Function,
	fn: TestFunction<object>,
	options?: number,
): void {
	const testName = `(Stylelint ${versionRange}) ${name.toString()}`;

	if (semver.satisfies(stylelintVersion, versionRange)) {
		// eslint-disable-next-line vitest/expect-expect, vitest/valid-title
		test(testName, fn, options);
	} else {
		// eslint-disable-next-line vitest/no-disabled-tests, vitest/valid-title
		test.skip(testName, fn, options);
	}
}

export const itOnVersion = testOnVersion;

export function describeOnVersion(
	versionRange: string,
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	name: string | Function,
	fn: SuiteFactory<object>,
): void {
	const describeName = `(Stylelint ${versionRange}) ${name.toString()}`;

	if (semver.satisfies(stylelintVersion, versionRange)) {
		// eslint-disable-next-line vitest/valid-title, vitest/valid-describe-callback
		describe(describeName, fn);
	} else {
		// eslint-disable-next-line vitest/no-disabled-tests, vitest/valid-title, vitest/valid-describe-callback
		describe.skip(describeName, fn);
	}
}
