import semver from 'semver';
import { version as stylelintVersion } from 'stylelint/package.json';
import { describe, SuiteFactory, test, TestFunction } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type TestName = string | Function;

export function testOnVersion(
	versionRange: string,
	name: TestName,
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

function assertDisjoint(ranges: string[]): void {
	for (let i = 0; i < ranges.length; i++) {
		for (let j = i + 1; j < ranges.length; j++) {
			if (semver.intersects(ranges[i], ranges[j], { includePrerelease: true })) {
				throw new Error(
					`Ranges "${ranges[i]}" and "${ranges[j]}" overlap. ` +
						'testOnVersions requires mutually exclusive ranges.',
				);
			}
		}
	}
}

export function testOnVersions(
	versionRanges: string[],
	name: TestName,
	fn: TestFunction<object>,
	options?: number,
): void {
	assertDisjoint(versionRanges);

	for (const versionRange of versionRanges) {
		testOnVersion(versionRange, name, fn, options);
	}
}

export const itOnVersion = testOnVersion;

export function describeOnVersion(
	versionRange: string,
	name: TestName,
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
