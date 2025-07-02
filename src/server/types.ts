import type { Connection, Disposable } from 'vscode-languageserver';
import type { TextDocuments } from 'vscode-languageserver/node';
import type { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import { CodeActionKind as VSCodeActionKind } from 'vscode-languageserver-types';
import type LSP from 'vscode-languageserver-protocol';
import type stylelint from 'stylelint';
import type winston from 'winston';
import type { StylelintRunner, LintDiagnostics } from '../utils/stylelint/index';
import type { ExtractKeysOfValueType } from '../utils/types';
import type { PackageManager, StylelintResolutionResult } from '../utils/packages/index';
import type { NotificationManager, CommandManager } from '../utils/lsp/index';

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
 * Context shared between the language server and its modules.
 */
export interface LanguageServerContext {
	/**
	 * The language server connection.
	 */
	connection: Connection;

	/**
	 * The notification manager for the connection.
	 */
	notifications: NotificationManager;

	/**
	 * The command manager for the connection.
	 */
	commands: CommandManager;

	/**
	 * The text document manager.
	 */
	documents: TextDocuments<TextDocument>;

	/**
	 * The runner with which to run Stylelint.
	 */
	runner: StylelintRunner;

	/**
	 * Displays the given error in the client using the language server
	 * connection.
	 * @param error The error to display.
	 */
	displayError(error: unknown): void;

	/**
	 * Gets the effective extension options for a resource, given its URI.
	 * @param uri The resource URI.
	 */
	getOptions(uri: string): Promise<LanguageServerOptions>;

	/**
	 * Returns the module with the given ID if it exists.
	 * @param id The ID of the module to return.
	 */
	getModule(id: string): LanguageServerModule | undefined;

	/**
	 * Lints a document using Stylelint and returns fix text edits.
	 * @param document The document to get text edits for.
	 * @param linterOptions Options to pass to the linter. Overridden by the
	 * language server options.
	 */
	getFixes(document: TextDocument, linterOptions?: stylelint.LinterOptions): Promise<TextEdit[]>;

	/**
	 * Lints a document using Stylelint and returns diagnostics.
	 * @param document The document to lint.
	 * @param linterOptions Options to pass to the linter. Overridden by the
	 * language server options.
	 */
	lintDocument(
		document: TextDocument,
		linterOptions?: Partial<stylelint.LinterOptions>,
	): Promise<LintDiagnostics | undefined>;

	/**
	 * Gets the edit info from the given diagnostic.
	 * @param document The document to lint.
	 * @param diagnostics The diagnostic to get the edit info for.
	 */
	getEditInfo(
		document: TextDocument,
		diagnostics: LSP.Diagnostic,
	): { label: string; edit: TextEdit } | undefined;

	/**
	 * Resolves the Stylelint package to be used for the given document.
	 * @param document The document to resolve the package for.
	 */
	resolveStylelint(document: TextDocument): Promise<StylelintResolutionResult | undefined>;
}

/**
 * A language server module.
 */
export interface LanguageServerModule extends Disposable {
	/**
	 * Handler called when the server is initializing.
	 */
	onInitialize?: (params: LSP.InitializeParams) => Partial<LSP.InitializeResult> | undefined | void;

	/**
	 * Handler called after the language server finishes registering handlers
	 * with the connection.
	 */
	onDidRegisterHandlers?: () => void;

	/**
	 * Handler called after the language server has finished responding to the
	 * onDidChangeConfiguration event.
	 */
	onDidChangeConfiguration?: () => Promise<void>;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string | symbol]: any;
}

/**
 * A language server module class.
 */
export interface LanguageServerModuleConstructor {
	/**
	 * The module's ID, used to identify the module in the language server's
	 * internal state and when logging. Should be a unique, short, lowercase
	 * string.
	 */
	id: string;
	new (params: LanguageServerModuleConstructorParameters): LanguageServerModule;
}

/**
 * Parameters for the {@link LanguageServerModuleConstructor} constructor.
 */
export type LanguageServerModuleConstructorParameters = {
	context: LanguageServerContext;
	logger?: winston.Logger;
};

/**
 * Language server event handler names.
 */
export type LanguageServerHandlers = ExtractKeysOfValueType<LanguageServerModule, () => unknown>;

/**
 * Parameters for language server event handlers, keyed by the handler name.
 */
export type LanguageServerHandlerParameters = {
	[key in LanguageServerHandlers]: Parameters<Required<LanguageServerModule>[key]>;
};

/**
 * Return types for language server event handlers, keyed by the handler name.
 */
export type LanguageServerHandlerReturnValues = {
	[key in LanguageServerHandlers]: ReturnType<Required<LanguageServerModule>[key]>;
};

/**
 * Language server constructor parameters.
 */
export type LanguageServerConstructorParameters = {
	/**
	 * The language server connection.
	 */
	connection: Connection;

	/**
	 * The logger to use. If not provided, a default logger will be used.
	 */
	logger?: winston.Logger;

	/**
	 * The modules to load.
	 */
	modules?: LanguageServerModuleConstructor[];
};

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
