import type stylelint from 'stylelint';
import type LSP from 'vscode-languageserver-protocol';
import type { RuleCustomization } from '../types.js';

export type Stylelint = typeof stylelint;
export type ConfigurationError = Error & { code: 78 };
export type RuleMetadataSnapshot = Record<string, stylelint.RuleMeta | undefined>;

export type RuleMetadataSource = {
	get(ruleName: string): stylelint.RuleMeta | undefined;
};

/**
 * Diagnostics for a lint run.
 */
export type LintDiagnostics = {
	/**
	 * The diagnostics, each corresponding to a warning or error emitted by
	 * Stylelint.
	 */
	diagnostics: LSP.Diagnostic[];

	/**
	 * Formatted report returned by Stylelint, if any.
	 */
	report?: string;

	/**
	 * Autofixed code returned by Stylelint when linting source text with `fix`
	 * enabled.
	 */
	code?: string;

	/**
	 * Raw output from Stylelint, if any. Deprecated in Stylelint 16 in favour of
	 * `report` and `code`.
	 */
	output?: string;

	/**
	 * Gets the original warning from the given diagnostic.
	 */
	getWarning?: (diagnostic: LSP.Diagnostic) => stylelint.Warning | null;
};

/**
 * Disable report rule names.
 */
export enum DisableReportRuleNames {
	Needless = '--report-needless-disables',
	InvalidScope = '--report-invalid-scope-disables',
	Descriptionless = '--report-descriptionless-disables',
	Illegal = 'reportDisables',
}

/**
 * Stylelint runner options.
 */
export type RunnerOptions = {
	config?: stylelint.Config | null;
	configBasedir?: string;
	configFile?: string;
	customSyntax?: string;
	ignoreDisables?: boolean;
	packageManager?: PackageManager;
	reportDescriptionlessDisables?: boolean;
	reportInvalidScopeDisables?: boolean;
	reportNeedlessDisables?: boolean;
	snippet?: string[];
	stylelintPath?: string;
	validate?: string[];
	rules?: {
		customizations?: RuleCustomization[];
	};
};

/**
 * Error thrown when a rule's option is invalid.
 */
export class InvalidOptionError extends Error {
	reasons: string[];

	constructor(warnings: { text: string }[]) {
		const reasons = warnings.map((warning) => warning.text);

		super(reasons.join('\n'));
		this.reasons = reasons;
	}
}

/**
 * Creates a rule metadata source from a Stylelint instance.
 */
export function createRuleMetadataSourceFromStylelint(
	stylelintInstance?: Stylelint,
): RuleMetadataSource | undefined {
	if (!stylelintInstance) {
		return undefined;
	}

	return {
		get: (ruleName: string) => {
			const rules = stylelintInstance.rules as
				| Record<string, { meta?: stylelint.RuleMeta }>
				| undefined;

			return rules?.[ruleName]?.meta;
		},
	};
}

/**
 * Creates a rule metadata source from a snapshot.
 */
export function createRuleMetadataSourceFromSnapshot(
	snapshot?: RuleMetadataSnapshot,
): RuleMetadataSource | undefined {
	if (!snapshot) {
		return undefined;
	}

	return {
		get: (ruleName: string) => snapshot[ruleName],
	};
}

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
	/** Absolute path to the resolved Stylelint entry file or package directory. */
	entryPath: string;
	/** Absolute path to the Stylelint package root (falls back to entryPath when unknown). */
	resolvedPath: string;
	/** Package version if known. */
	version?: string;
};

/**
 * A tracer function that can be used to log messages.
 */
export type TracerFn = (message: string, verbose?: string) => void;
