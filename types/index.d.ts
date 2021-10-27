// Make module namespaces available globally
import postcss = imports.postcss;
import stylelint = imports.stylelint;
import vscode = imports.vscode;
import vscodeLanguageServer = imports.vscodeLanguageServer;
import vscodeLanguageServerProtocol = imports.vscodeLanguageServerProtocol;
import vscodeLanguageServerTextDocument = imports.vscodeLanguageServerTextDocument;
import vscodeLanguageServerTypes = imports.vscodeLanguageServerTypes;
import winston = imports.winston;
import winstonTransport = imports.winstonTransport;

/**
 * Language Server Protocol and VS Code language server types.
 */
declare namespace lsp {
	export import CodeDescription = vscodeLanguageServerTypes.CodeDescription;
	export import CompletionItem = vscodeLanguageServerTypes.CompletionItem;
	export import CompletionParams = vscodeLanguageServer.CompletionParams;
	export import Connection = vscodeLanguageServer.Connection;
	export import Diagnostic = vscodeLanguageServerTypes.Diagnostic;
	export import DiagnosticRelatedInformation = vscodeLanguageServerTypes.DiagnosticRelatedInformation;
	export import DiagnosticSeverity = vscodeLanguageServerTypes.DiagnosticSeverity;
	export import DidChangeConfigurationNotification = vscodeLanguageServerProtocol.DidChangeConfigurationNotification;
	export import DidChangeConfigurationParams = vscodeLanguageServerProtocol.DidChangeConfigurationParams;
	export import Disposable = vscodeLanguageServer.Disposable;
	export import DocumentUri = vscodeLanguageServerTypes.DocumentUri;
	export import FormattingOptions = vscodeLanguageServerTypes.FormattingOptions;
	export import InitializeParams = vscodeLanguageServer.InitializeParams;
	export import InitializeResult = vscodeLanguageServer.InitializeResult;
	export import Position = vscodeLanguageServerTypes.Position;
	export import Range = vscodeLanguageServerTypes.Range;
	export import RemoteConsole = vscodeLanguageServer.RemoteConsole;
	export import TextDocument = vscodeLanguageServerTextDocument.TextDocument;
	export import TextDocuments = vscodeLanguageServer.TextDocuments;
	export import TextEdit = vscodeLanguageServerTypes.TextEdit;
	export import URI = vscodeLanguageServerTypes.URI;
}

/**
 * Makes all properties of type `T` optional except for those in `K`.
 */
type OptionalExcept<T extends Record<any, any>, K extends keyof T> = Pick<T, K> &
	Partial<Pick<T, K>>;

/**
 * Makes all properties of type `T` required except for those in `K`.
 */
type RequiredExcept<T extends Record<any, any>, K extends keyof T> = Pick<T, Exclude<keyof T, K>> &
	Required<Pick<T, K>>;

/**
 * Extracts keys from a type `T` the values of which are type `V`.
 */
type ExtractKeysOfValueType<T, V> = {
	[K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

/**
 * Package manager identifiers.
 */
type PackageManager = 'npm' | 'yarn' | 'pnpm';

/**
 * An invalid option error.
 */
type InvalidOptionError = Error & { reasons: string[] };

// TODO: Create type upstream
/**
 * A Stylelint configuration error. Taken from
 * https://github.com/stylelint/stylelint/blob/551dcb5/lib/utils/configurationError.js
 */
type ConfigurationError = Error & { code: 78 };

/**
 * A tracer function that can be used to log messages.
 */
type TracerFn = (message: string, verbose?: string) => void;

/**
 * Global `node_modules` path resolver.
 */
type GlobalPathResolver = {
	/**
	 * Resolves the global `node_modules` path for the given package manager.
	 * When a path cannot be resolved, returns `undefined`. Traces resolution
	 * using the given tracer if one is provided.
	 *
	 * Paths are cached in the resolver on the first successful resolution.
	 *
	 * @example
	 * ```js
	 * const pnpmGlobalPath = await resolver.resolve(
	 *   'pnpm',
	 *   message => connection && connection.tracer.log(message)
	 * );
	 * ```
	 * @param {trace}
	 */
	resolve: (packageManager: PackageManager, trace?: TracerFn) => Promise<string | undefined>;
};

/**
 * The global `node_modules` path resolver cache.
 */
type GlobalPathResolverCache = {
	[packageManager: string]: string | undefined;
};

/**
 * Sisable directive comment types.
 */
type DisableType = 'stylelint-disable' | 'stylelint-disable-line' | 'stylelint-disable-next-line';

/**
 * Stylelint runner.
 */
type StylelintRunner = import('../src/utils/stylelint/stylelint-runner').StylelintRunner;

/**
 * The vscode-stylelint extension options. Overrides any options in the
 * workspace Stylelint configuration.
 */
type ExtensionOptions = {
	config?: stylelint.Config | null;
	configBasedir?: string;
	configFile?: string;
	customSyntax?: string;
	ignoreDisables?: boolean;
	packageManager?: PackageManager;
	reportInvalidScopeDisables?: boolean;
	reportNeedlessDisables?: boolean;
	snippet?: string[];
	stylelintPath?: string;
	validate?: string[];
};

/**
 * Options for resolving the Stylelint package.
 */
type ResolverOptions = Pick<ExtensionOptions, 'packageManager' | 'stylelintPath'>;

/**
 * Diagnostics for a lint run.
 */
type LintDiagnostics = {
	/**
	 * The diagnostics, each corresponding to a warning or error emitted by
	 * Stylelint.
	 */
	diagnostics: lsp.Diagnostic[];

	/**
	 * Raw output from Stylelint, if any.
	 */
	output?: string;
};

/**
 * Stylelint package resolution result.
 */
type StylelintResolutionResult = {
	stylelint: stylelint.PublicApi;
	resolvedPath: string;
};

/**
 * Parameters for the {@link LanguageServerModule.onDidChangeValidateLanguages}
 * event.
 */
interface DidChangeValidateLanguagesParams {
	/**
	 * IDs for the languages that should be validated.
	 */
	languages: Set<string>;

	/**
	 * IDs for the languages that should no longer be validated.
	 */
	removedLanguages: Set<string>;
}

/**
 * Parameters for the {@link LanguageServerModule.onDidChangeConfiguration}
 * event.
 *
 * Note: This is not the same as {@link lsp.DidChangeConfigurationParams}, which
 * is used for the {@link lsp.DidChangeConfigurationNotification}.
 */
interface DidChangeConfigurationParams {
	settings: LanguageServerOptions;
}

/**
 * A language server module.
 */
interface LanguageServerModule {
	/**
	 * Handler called when the server is initializing.
	 */
	onInitialize?: (params: lsp.InitializeParams) => Partial<lsp.InitializeResult> | undefined | void;

	/**
	 * Handler called after the language server finishes registering handlers
	 * with the connection.
	 */
	onDidRegisterHandlers?: () => void;

	/**
	 * Handler called after the language server has finished receiving, parsing,
	 * and setting updated configuration.
	 */
	onDidChangeConfiguration?: (params: DidChangeConfigurationParams) => void;

	/**
	 * Handler called after the languages for which documents should be
	 * validated have changed.
	 */
	onDidChangeValidateLanguages?: (params: DidChangeValidateLanguagesParams) => void;

	[key: string | symbol]: any;
}

/**
 * A language server module class.
 */
interface LanguageServerModuleConstructor {
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
type LanguageServerModuleConstructorParameters = {
	context: LanguageServerContext;
	logger?: winston.Logger;
};

/**
 * Language server event handler names.
 */
type LanguageServerHandlers = ExtractKeysOfValueType<LanguageServerModule, Function | undefined>;

/**
 * Parameters for language server event handlers, keyed by the handler name.
 */
type LanguageServerHandlerParameters = {
	[key in LanguageServerHandlers]: Parameters<Required<LanguageServerModule>[key]>;
};

/**
 * Return types for language server event handlers, keyed by the handler name.
 */
type LanguageServerHandlerReturnValues = {
	[key in LanguageServerHandlers]: ReturnType<Required<LanguageServerModule>[key]>;
};

/**
 * Language server constructor parameters.
 */
type LanguageServerConstructorParameters = {
	/**
	 * The language server connection.
	 */
	connection: lsp.Connection;

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
type LanguageServerOptions = RequiredExcept<
	ExtensionOptions,
	'packageManager' | 'snippet' | 'validate'
>;

/**
 * Context shared between the language server and its modules.
 */
interface LanguageServerContext {
	/**
	 * The language server connection.
	 */
	connection: lsp.Connection;

	/**
	 * The text document manager.
	 */
	documents: lsp.TextDocuments<lsp.TextDocument>;

	/**
	 * The current language server options.
	 */
	options: LanguageServerOptions;

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
	getFixes(
		document: lsp.TextDocument,
		linterOptions?: stylelint.LinterOptions,
	): Promise<lsp.TextEdit[]>;

	/**
	 * Lints a document using Stylelint and returns diagnostics.
	 * @param document The document to lint.
	 * @param linterOptions Options to pass to the linter. Overridden by the
	 * language server options.
	 */
	lintDocument(
		document: lsp.TextDocument,
		linterOptions?: Partial<stylelint.LinterOptions>,
	): Promise<LintDiagnostics | undefined>;

	/**
	 * Resolves the Stylelint package to be used for the given document.
	 * @param document The document to resolve the package for.
	 */
	resolveStylelint(document: lsp.TextDocument): Promise<StylelintResolutionResult | undefined>;
}

/**
 * Language server log transport options.
 */
type LanguageServerTransportOptions = winstonTransport.TransportStreamOptions & {
	connection: lsp.Connection;
};

/**
 * Language server log formatter constructor.
 */
type LanguageServerFormatterConstructor = {
	new (options: LanguageServerFormatterOptions): LanguageServerFormatter;
};

/**
 * Language server log formatter.
 */
type LanguageServerFormatter = winston.Logform.Format & {
	/**
	 * Formats a log object.
	 * @param info The log object to format.
	 */
	transform(info: winston.Logform.TransformableInfo): winston.Logform.TransformableInfo;

	/**
	 * The options used to format the log object.
	 */
	options: LanguageServerFormatterOptions;
};

/**
 * Language server log formatter options.
 */
type LanguageServerFormatterOptions = {
	connection: lsp.Connection;
	preferredKeyOrder?: string[];
};

/**
 * VS Code extension event names.
 */
interface ExtensionEvents {
	DidRegisterDocumentFormattingEditProvider: () => void;
}

/**
 * VS Code extension public API.
 */
type ExtensionPublicApi = import('typed-emitter').default<ExtensionEvents> & {
	formattingReady: boolean;
};
