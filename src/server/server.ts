import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import type { Connection } from 'vscode-languageserver';
import type LSP from 'vscode-languageserver-protocol';
import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocumentSyncKind } from 'vscode-languageserver-protocol';
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
	 * The language server options.
	 */
	#options: LanguageServerOptions;

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
	 * Whether or not the server has sent its first configuration change to
	 * modules.
	 */
	#hasSentInitialConfiguration = false;

	/**
	 * Creates a new Stylelint language server.
	 * @param {LanguageServerConstructorParameters} params
	 */
	constructor({ connection, logger, modules }: LanguageServerConstructorParameters) {
		this.#connection = connection;
		this.#logger = logger?.child({ component: 'language-server' });
		this.#options = defaultOptions;
		this.#resolver = new StylelintResolver(connection, this.#logger);
		this.#runner = new StylelintRunner(connection, this.#logger, this.#resolver);
		this.#documents = new TextDocuments(TextDocument);
		this.#context = {
			connection: this.#connection,
			documents: this.#documents,
			options: this.#options,
			runner: this.#runner,
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

		this.#registerHandlers();

		this.#documents.listen(this.#connection);
		this.#connection.listen();

		this.#logger?.info('Language server started');
	}

	#displayError(error: unknown): void {
		displayError(this.#connection, error);
	}

	/**
	 * Resolves the Stylelint package for the given document.
	 */
	async #resolveStylelint(document: TextDocument): Promise<StylelintResolutionResult | undefined> {
		this.#logger?.debug('Resolving Stylelint', { uri: document.uri });

		try {
			const result = await this.#resolver.resolve(this.#options, document);

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
			const results = await this.#runner.lintDocument(document, linterOptions, this.#options);

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
			const edits = await getFixes(this.#runner, document, linterOptions, this.#options);

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
	 * Sets the language server options.
	 */
	#setOptions(options: Partial<LanguageServerOptions>): void {
		this.#options = {
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

		Object.freeze(this.#options);

		this.#context.options = this.#options;

		this.#logger?.debug('Options updated', { options: this.#options });
	}

	/**
	 * Registers handlers on the language server connection, then invokes the
	 * `onDidRegisterHandlers` event for each registered module to allow them
	 * to register their handlers.
	 */
	#registerHandlers(): void {
		this.#logger?.info('Registering handlers');

		this.#connection.onInitialize(this.#onInitialize.bind(this));

		this.#logger?.debug('onInitialize handler registered');

		this.#connection.onDidChangeConfiguration(this.#onDidChangeConfiguration.bind(this));

		this.#logger?.debug('onDidChangeConfiguration handler registered');

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

		for (const [, moduleResult] of Object.entries(this.#invokeHandlers('onInitialize', params))) {
			if (moduleResult) {
				deepAssign(result, moduleResult);
			}
		}

		this.#logger?.debug('Returning initialization results', { result });

		return result;
	}

	#onDidChangeConfiguration(params: LSP.DidChangeConfigurationParams): void {
		this.#logger?.debug('received onDidChangeConfiguration', { params });

		const oldOptions = this.#options;

		this.#setOptions(params.settings.stylelint);

		const validateLanguageSet = new Set(this.#options.validate);
		const oldValidateLanguageSet = new Set(oldOptions.validate);

		/** Whether or not the list of languages that should be validated has changed. */
		let changed = validateLanguageSet.size !== oldValidateLanguageSet.size;

		/** The languages removed from the list of languages that should be validated */
		const removedLanguages = new Set();

		// Check if the sets are unequal, which means that the list of languages that should be
		// validated has changed.
		for (const language of oldValidateLanguageSet) {
			if (!validateLanguageSet.has(language)) {
				removedLanguages.add(language);
				changed = true;
			}
		}

		if (changed || !this.#hasSentInitialConfiguration) {
			if (this.#logger?.isDebugEnabled()) {
				this.#logger?.debug('Languages that should be validated changed', {
					languages: [...validateLanguageSet],
					removedLanguages: [...removedLanguages],
				});
			}

			this.#invokeHandlers('onDidChangeValidateLanguages', {
				languages: validateLanguageSet,
				removedLanguages,
			});
		}

		this.#invokeHandlers('onDidChangeConfiguration', { settings: this.#options });

		this.#hasSentInitialConfiguration = true;
	}
}
