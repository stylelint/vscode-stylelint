import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import type { Connection, TextDocumentChangeEvent } from 'vscode-languageserver';
import type LSP from 'vscode-languageserver-protocol';
import { TextDocuments } from 'vscode-languageserver/node';
import {
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
} from 'vscode-languageserver-protocol';
// eslint-disable-next-line node/no-unpublished-import
import type stylelint from 'stylelint';
import type winston from 'winston';

import { getFixes } from '../utils/documents';
import { displayError } from '../utils/lsp';
import { deepAssign } from '../utils/objects';
import { StylelintRunner, LintDiagnostics } from '../utils/stylelint';
import { StylelintResolver, StylelintResolutionResult } from '../utils/packages';
import type {
	LanguageServerOptions,
	LanguageServerContext,
	LanguageServerModule,
	LanguageServerConstructorParameters,
	LanguageServerHandlerParameters,
	LanguageServerHandlerReturnValues,
} from './types';

const defaultOptions: LanguageServerOptions = {
	packageManager: 'npm',
	validate: ['css', 'postcss'],
	snippet: ['css', 'postcss'],
};

/**
 * Stylelint language server.
 */
export class StylelintLanguageServer {
	/**
	 * The language server connection.
	 */
	#connection: Connection;

	/**
	 * The logger to use, if any.
	 */
	#logger: winston.Logger | undefined;

	/**
	 * The global language server options, used if the client does not support
	 * the `workspace/configuration` request.
	 */
	#globalOptions: LanguageServerOptions;

	/**
	 * The resolver used to resolve the Stylelint package.
	 */
	#resolver: StylelintResolver;

	/**
	 * The runner used to run Stylelint.
	 */
	#runner: StylelintRunner;

	/**
	 * The text document manager.
	 */
	#documents: TextDocuments<TextDocument>;

	/**
	 * The language server context passed between modules.
	 */
	#context: LanguageServerContext;

	/**
	 * Registered modules.
	 */
	#modules: Map<string, LanguageServerModule> = new Map();

	/**
	 * Whether or not the client supports the `workspace/configuration` request.
	 */
	#hasConfigurationCapability = false;

	/**
	 * Configuration per resource.
	 */
	#scopedOptions = new Map<string, LanguageServerOptions>();

	/**
	 * Creates a new Stylelint language server.
	 */
	constructor({ connection, logger, modules }: LanguageServerConstructorParameters) {
		this.#connection = connection;
		this.#logger = logger?.child({ component: 'language-server' });
		this.#globalOptions = defaultOptions;
		this.#resolver = new StylelintResolver(connection, this.#logger);
		this.#runner = new StylelintRunner(connection, this.#logger, this.#resolver);
		this.#documents = new TextDocuments(TextDocument);
		this.#context = {
			connection: this.#connection,
			documents: this.#documents,
			runner: this.#runner,
			getOptions: this.#getOptions.bind(this),
			getModule: this.#getModule.bind(this),
			getFixes: this.#getFixes.bind(this),
			displayError: this.#displayError.bind(this),
			lintDocument: this.#lintDocument.bind(this),
			resolveStylelint: this.#resolveStylelint.bind(this),
		};

		const contextReadOnlyProxy = new Proxy(this.#context, {
			get(target, name) {
				return target[name as keyof typeof target];
			},

			set() {
				throw new Error('Cannot set read-only property');
			},
		});

		if (modules) {
			for (const Module of modules) {
				this.#logger?.info('Registering module', { module: Module.id });

				if (!Module.id) {
					throw new Error('Modules must have an ID');
				}

				if (typeof Module.id !== 'string') {
					throw new Error('Module IDs must be strings');
				}

				const module = new Module({
					context: contextReadOnlyProxy,
					logger: logger?.child({ component: `language-server:${Module.id}` }),
				});

				if (this.#modules.has(Module.id)) {
					throw new Error(`Module with ID "${Module.id}" already registered`);
				}

				this.#modules.set(Module.id, module);

				this.#logger?.info('Module registered', { module: Module.id });
			}
		}
	}

	/**
	 * Starts the language server.
	 */
	start(): void {
		this.#logger?.info('Starting language server');

		this.#documents.listen(this.#connection);
		this.#connection.listen();

		this.#registerHandlers();

		this.#logger?.info('Language server started');
	}

	#displayError(error: unknown): void {
		displayError(this.#connection, error);
	}

	async #getOptions(resource: string): Promise<LanguageServerOptions> {
		if (!this.#hasConfigurationCapability) {
			return this.#globalOptions;
		}

		const cached = this.#scopedOptions.get(resource);

		if (cached) {
			return cached;
		}

		const options = await this.#connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'stylelint',
		});

		const withDefaults = this.#getEffectiveOptions(options);

		Object.freeze(withDefaults);

		this.#scopedOptions.set(resource, withDefaults);

		return withDefaults;
	}

	/**
	 * Resolves the Stylelint package for the given document.
	 */
	async #resolveStylelint(document: TextDocument): Promise<StylelintResolutionResult | undefined> {
		this.#logger?.debug('Resolving Stylelint', { uri: document.uri });

		try {
			const options = await this.#getOptions(document.uri);

			const result = await this.#resolver.resolve(options, document);

			if (result) {
				this.#logger?.debug('Stylelint resolved', {
					uri: document.uri,
					resolvedPath: result.resolvedPath,
				});
			} else {
				this.#logger?.warn('Failed to resolve Stylelint', { uri: document.uri });
			}

			return result;
		} catch (error) {
			this.#displayError(error);
			this.#logger?.error('Error resolving Stylelint', { uri: document.uri, error });

			return undefined;
		}
	}

	/**
	 * Lints a document using Stylelint.
	 */
	async #lintDocument(
		document: TextDocument,
		linterOptions: Partial<stylelint.LinterOptions> = {},
	): Promise<LintDiagnostics | undefined> {
		this.#logger?.debug('Linting document', { uri: document.uri, linterOptions });

		try {
			const options = await this.#getOptions(document.uri);

			const results = await this.#runner.lintDocument(document, linterOptions, options);

			this.#logger?.debug('Lint run complete', { uri: document.uri, results });

			return results;
		} catch (err) {
			this.#displayError(err);
			this.#logger?.error('Error running lint', { uri: document.uri, error: err });

			return undefined;
		}
	}

	/**
	 * Gets text edits for fixes made by Stylelint.
	 */
	async #getFixes(
		document: TextDocument,
		linterOptions: stylelint.LinterOptions = {},
	): Promise<TextEdit[]> {
		try {
			const options = await this.#getOptions(document.uri);

			const edits = await getFixes(this.#runner, document, linterOptions, options);

			this.#logger?.debug('Fixes retrieved', { uri: document.uri, edits });

			return edits;
		} catch (error) {
			this.#displayError(error);
			this.#logger?.error('Error getting fixes', { uri: document.uri, error });

			return [];
		}
	}

	/**
	 * Gets the registered module with the given ID if it exists.
	 */
	#getModule(id: string): LanguageServerModule | undefined {
		return this.#modules.get(id);
	}

	/**
	 * Returns a shallow copy of the given options with defaults set for options
	 * that are not set. If no options are given, the default options are returned.
	 */
	#getEffectiveOptions(options: Partial<LanguageServerOptions> = {}): LanguageServerOptions {
		const withDefaults = {
			config: options.config,
			configBasedir: options.configBasedir,
			configFile: options.configFile,
			customSyntax: options.customSyntax,
			ignoreDisables: options.ignoreDisables,
			packageManager: options.packageManager || defaultOptions.packageManager,
			reportInvalidScopeDisables: options.reportInvalidScopeDisables,
			reportNeedlessDisables: options.reportNeedlessDisables,
			snippet: options.snippet ?? defaultOptions.snippet,
			stylelintPath: options.stylelintPath,
			validate: options.validate ?? defaultOptions.validate,
		};

		return withDefaults;
	}

	/**
	 * Registers handlers on the language server connection, then invokes the
	 * `onDidRegisterHandlers` event for each registered module to allow them
	 * to register their handlers.
	 */
	#registerHandlers(): void {
		this.#logger?.info('Registering handlers');

		this.#connection.onInitialize(this.#onInitialize.bind(this));
		this.#logger?.debug('connection.onInitialize handler registered');

		this.#connection.onInitialized(this.#onInitialized.bind(this));
		this.#logger?.debug('connection.onInitialized handler registered');

		this.#connection.onDidChangeConfiguration(this.#onDidChangeConfiguration.bind(this));
		this.#logger?.debug('connection.onDidChangeConfiguration handler registered');

		this.#documents.onDidClose(this.#onDidCloseDocument.bind(this));
		this.#logger?.debug('documents.onDidClose handler registered');

		this.#invokeHandlers('onDidRegisterHandlers');

		this.#logger?.info('Handlers registered');
	}

	/**
	 * Calls the given handler for all registered modules.
	 */
	#invokeHandlers<
		K extends keyof LanguageServerHandlerParameters,
		P extends LanguageServerHandlerParameters[K],
		R extends LanguageServerHandlerReturnValues[K],
	>(handlerName: K, ...params: P): { [moduleName: string]: R[] } {
		this.#logger?.debug(`Invoking ${handlerName}`);

		const returnValues: { [moduleName: string]: R[] } = Object.create(null);

		for (const [id, module] of this.#modules) {
			const handler = module[handlerName];

			if (handler) {
				try {
					returnValues[id] = handler.apply(module, params);

					this.#logger?.debug(`Invoked ${handlerName}`, {
						module: id,
						returnValue: returnValues[id],
					});
				} catch (error) {
					this.#displayError(error);
					this.#logger?.error(`Error invoking ${handlerName}`, {
						module: id,
						error,
					});
				}
			}
		}

		return returnValues;
	}

	#onInitialize(params: LSP.InitializeParams): LSP.InitializeResult {
		this.#logger?.debug('received onInitialize', { params });

		const result: LSP.InitializeResult = {
			capabilities: {
				textDocumentSync: {
					openClose: true,
					change: TextDocumentSyncKind.Full,
				},
			},
		};

		if (params.capabilities.workspace?.configuration) {
			this.#logger?.debug(
				'Client reports workspace configuration support; using scoped configuration',
			);

			this.#hasConfigurationCapability = true;
		}

		for (const [, moduleResult] of Object.entries(this.#invokeHandlers('onInitialize', params))) {
			if (moduleResult) {
				deepAssign(result, moduleResult);
			}
		}

		this.#logger?.debug('Returning initialization results', { result });

		return result;
	}

	#onInitialized(params: LSP.InitializedParams): void {
		this.#logger?.debug('received onInitialized', { params });

		if (this.#hasConfigurationCapability) {
			this.#logger?.debug('Registering DidChangeConfigurationNotification');

			this.#connection.client.register(DidChangeConfigurationNotification.type);
		}
	}

	#onDidCloseDocument({ document }: TextDocumentChangeEvent<TextDocument>): void {
		this.#logger?.debug('received documents.onDidClose, clearing cached options', {
			uri: document.uri,
		});

		this.#scopedOptions.delete(document.uri);
	}

	#onDidChangeConfiguration(params: LSP.DidChangeConfigurationParams): void {
		if (this.#hasConfigurationCapability) {
			this.#logger?.debug('received onDidChangeConfiguration, clearing cached options', { params });

			this.#scopedOptions.clear();

			this.#invokeHandlers('onDidChangeConfiguration');

			return;
		}

		this.#logger?.debug('received onDidChangeConfiguration', { params });

		this.#globalOptions = this.#getEffectiveOptions(params.settings.stylelint);

		Object.freeze(this.#globalOptions);

		this.#logger?.debug('Global options updated', { options: this.#globalOptions });

		this.#invokeHandlers('onDidChangeConfiguration');
	}
}
