import { CodeActionKind as VSCodeActionKind } from 'vscode-languageserver-types';
import type stylelint from 'stylelint';
import type { PackageManager } from './stylelint/index.js';

/**
 * Command IDs
 */
export enum CommandId {
	ApplyAutoFix = 'stylelint.applyAutoFix',
	OpenRuleDoc = 'stylelint.openRuleDoc',
	LintFiles = 'stylelint.lintFiles',
	ClearAllProblems = 'stylelint.clearAllProblems',
}

/**
 * Code action kinds
 */
export const CodeActionKind = {
	StylelintSourceFixAll: `${VSCodeActionKind.SourceFixAll}.stylelint`,
};

/**
 * Severity override types.
 */
export type SeverityOverride =
	| 'downgrade'
	| 'upgrade'
	| 'error'
	| 'warn'
	| 'info'
	| 'off'
	| 'default';

/**
 * Rule customization for severity overrides.
 */
export type RuleCustomization = {
	/**
	 * Rule name pattern to match. Use `*` to match all rules.
	 */
	rule: string;

	/**
	 * Severity override. `downgrade` converts errors to warnings, `upgrade` converts warnings to errors,
	 * or specify exact severity.
	 */
	severity: SeverityOverride;
};

/**
 * Run mode for the linter. `onType` lints as you type, while `onSave` only
 * lints after saving a document.
 */
export type RunMode = 'onSave' | 'onType';

/**
 * Language server options.
 */
export type LanguageServerOptions = {
	codeAction: {
		disableRuleComment: {
			location: 'separateLine' | 'sameLine';
		};
	};
	config?: stylelint.Config | null;
	configBasedir?: string;
	configFile?: string;
	customSyntax?: string;
	ignoreDisables?: boolean;
	ignorePath?: string;
	packageManager: PackageManager;
	reportDescriptionlessDisables?: boolean;
	reportInvalidScopeDisables?: boolean;
	reportNeedlessDisables?: boolean;
	run: RunMode;
	rules?: {
		customizations?: RuleCustomization[];
	};
	snippet: string[];
	stylelintPath?: string;
	validate: string[];
	lintFiles: {
		glob: string;
	};
};

export interface PnPConfiguration {
	registerPath: string;
	loaderPath?: string;
}
