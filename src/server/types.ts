import type { Connection } from 'vscode-languageserver';
import type { TextDocuments } from 'vscode-languageserver/node';
import type { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import { CodeActionKind as VSCodeActionKind } from 'vscode-languageserver-types';
import type LSP from 'vscode-languageserver-protocol';
// eslint-disable-next-line node/no-unpublished-import
import type stylelint from 'stylelint';
import type winston from 'winston';
import type { StylelintRunner, LintDiagnostics } from '../utils/stylelint';
import type { ExtractKeysOfValueType } from '../utils/types';
import type { PackageManager, StylelintResolutionResult } from '../utils/packages';

/**
 * Command IDs
 */
export enum CommandId {
	ApplyAutoFix = 'stylelint.applyAutoFix',
}

/**
 * Code action kinds
 */
export const CodeActionKind = {
	StylelintSourceFixAll: `${VSCodeActionKind.SourceFixAll}.stylelint`,
};

/**
 * Language server notification names.
 */
export enum Notification {
	DidRegisterDocumentFormattingEditProvider = 'textDocument/didRegisterDocumentFormattingEditProvider',
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
	 * Resolves the Stylelint package to be used for the given document.
	 * @param document The document to resolve the package for.
	 */
	resolveStylelint(document: TextDocument): Promise<StylelintResolutionResult | undefined>;
}

/**
 * Parameters for the {@link LanguageServerModule.onDidChangeConfiguration}
 * event.
 *
 * Note: This is not the same as {@link LSP.DidChangeConfigurationParams}, which
 * is used for the {@link LSP.DidChangeConfigurationNotification}.
 */
export interface DidChangeConfigurationParams {
	settings: LanguageServerOptions;
}

/**
 * A language server module.
 */
export interface LanguageServerModule {
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
	onDidChangeConfiguration?: (params: DidChangeConfigurationParams) => void;

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
export type LanguageServerHandlers = ExtractKeysOfValueType<
	LanguageServerModule,
	() => unknown | undefined
>;

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
	 * The logger to use.
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
	config?: stylelint.Config | null;
	configBasedir?: string;
	configFile?: string;
	customSyntax?: string;
	ignoreDisables?: boolean;
	packageManager: PackageManager;
	reportInvalidScopeDisables?: boolean;
	reportNeedlessDisables?: boolean;
	snippet: string[];
	stylelintPath?: string;
	validate: string[];
};
