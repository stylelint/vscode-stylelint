import type LSP from 'vscode-languageserver-protocol';

/**
 * Code actions for a particular rule.
 */
export interface RuleCodeActions {
	/**
	 * Action to disable the rule for a specific line.
	 */
	disableLine?: LSP.CodeAction;

	/**
	 * Action to disable the rule for an entire file.
	 */
	disableFile?: LSP.CodeAction;

	/**
	 * Action to show documentation for the rule.
	 */
	documentation?: LSP.CodeAction;
}
