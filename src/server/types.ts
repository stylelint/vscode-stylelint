import { CodeActionKind as VSCodeActionKind } from 'vscode-languageserver-types';
import type LSP from 'vscode-languageserver-protocol';
import type stylelint from 'stylelint';
import type { PackageManager } from './stylelint/index.js';

/**
 * Command IDs
 */
export enum CommandId {
	ApplyAutoFix = 'stylelint.applyAutoFix',
	OpenRuleDoc = 'stylelint.openRuleDoc',
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
 * Language server notification names.
 */
export enum Notification {
	DidRegisterCodeActionRequestHandler = 'stylelint/didRegisterCodeActionRequestHandler',
	DidRegisterDocumentFormattingEditProvider = 'stylelint/didRegisterDocumentFormattingEditProvider',
	DidResetConfiguration = 'stylelint/didResetConfiguration',
	ResetWorkspaceState = 'stylelint/resetWorkspaceState',
}

/**
 * `DidRegisterDocumentFormattingEditProvider` notification parameters.
 */
export interface DidRegisterDocumentFormattingEditProviderNotificationParams {
	/**
	 * The URI of the document for which the formatting provider was registered.
	 */
	readonly uri: string;

	/**
	 * The options used to register the document formatting provider.
	 */
	readonly options: LSP.DocumentFormattingRegistrationOptions;
}

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
	packageManager: PackageManager;
	reportDescriptionlessDisables?: boolean;
	reportInvalidScopeDisables?: boolean;
	reportNeedlessDisables?: boolean;
	rules?: {
		customizations?: RuleCustomization[];
	};
	snippet: string[];
	stylelintPath?: string;
	validate: string[];
};

export interface PnPConfiguration {
	registerPath: string;
	loaderPath?: string;
}
