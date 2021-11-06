// eslint-disable-next-line node/no-unpublished-import
import type stylelint from 'stylelint';

/**
 * Package manager identifiers.
 */
export type PackageManager = 'npm' | 'yarn' | 'pnpm';

/**
 * Options for resolving the Stylelint package.
 */
export type ResolverOptions = {
	packageManager?: PackageManager;
	stylelintPath?: string;
};

/**
 * Stylelint package resolution result.
 */
export type StylelintResolutionResult = {
	stylelint: stylelint.PublicApi;
	resolvedPath: string;
};

/**
 * A tracer function that can be used to log messages.
 */
export type TracerFn = (message: string, verbose?: string) => void;
