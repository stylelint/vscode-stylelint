'use strict';

const { TextDocument } = require('vscode-languageserver-textdocument');
const { TextDocuments } = require('vscode-languageserver/node');
const { TextDocumentSyncKind } = require('vscode-languageserver-protocol');

const { getFixes } = require('../utils/documents');
const { displayError } = require('../utils/lsp');
const { deepAssign } = require('../utils/objects');
const { StylelintRunner } = require('../utils/stylelint');

/** @type {LanguageServerOptions} */
const defaultOptions = {
	packageManager: 'npm',
	validate: ['css', 'less', 'postcss'],
	snippet: ['css', 'less', 'postcss'],
};

/**
 * Stylelint language server.
 */
class StylelintLanguageServer {
	/**
	 * The language server connection.
	 * @type {lsp.Connection}
	 */
	#connection;

	/**
	 * The logger to use, if any.
	 * @type {winston.Logger | undefined}
	 */
	#logger;

	/**
	 * The language server options.
	 * @type {LanguageServerOptions}
	 */
	#options;

	/**
	 * The runner used to run Stylelint.
	 * @type {StylelintRunner}
	 */
	#runner;

	/**
	 * The text document manager.
	 * @type {lsp.TextDocuments<lsp.TextDocument>}
	 */
	#documents;

	/**
	 * The language server context passed between modules.
	 * @type {LanguageServerContext}
	 */
	#context;

	/**
	 * Registered modules.
	 * @type {Map<string, LanguageServerModule>}
	 */
	#modules = new Map();

	/**
	 * Creates a new Stylelint language server.
	 * @param {LanguageServerConstructorParameters} params
	 */
	constructor({ connection, logger, modules }) {
		this.#connection = connection;
		this.#logger = logger?.child({ component: 'language-server' });
		this.#options = defaultOptions;
		this.#runner = new StylelintRunner(connection, this.#logger);
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
		};

		const contextReadOnlyProxy = new Proxy(this.#context, {
			get(target, name) {
				return target[/** @type {keyof typeof target} */ (name)];
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
	start() {
		this.#logger?.info('Starting language server');

		this.#registerHandlers();

		this.#documents.listen(this.#connection);
		this.#connection.listen();

		this.#logger?.info('Language server started');
	}

	/**
	 * @param {unknown} error
	 */
	#displayError(error) {
		displayError(this.#connection, error);
	}

	/**
	 * Lints a document using Stylelint.
	 * @param {lsp.TextDocument} document
	 * @param {Partial<stylelint.LinterOptions>} [linterOptions]
	 * @returns {Promise<LintDiagnostics | undefined>}
	 */
	async #lintDocument(document, linterOptions = {}) {
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
	 * @param {lsp.TextDocument} document
	 * @param {stylelint.LinterOptions} [linterOptions]
	 * @returns {Promise<lsp.TextEdit[]>}
	 */
	async #getFixes(document, linterOptions = {}) {
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
	 * @param {string} id
	 * @returns {LanguageServerModule | undefined}
	 */
	#getModule(id) {
		return this.#modules.get(id);
	}

	/**
	 * Sets the language server options.
	 * @param {ExtensionOptions} options
	 */
	#setOptions(options) {
		/** @type {LanguageServerOptions} */
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
	#registerHandlers() {
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
	 * @template {keyof LanguageServerHandlerParameters} K
	 * @template {LanguageServerHandlerParameters[K]} P
	 * @template {LanguageServerHandlerReturnValues[K]} R
	 * @param {K} handlerName
	 * @param {P} params
	 * @returns {{[moduleName: string]: R[]}}
	 */
	#invokeHandlers(handlerName, ...params) {
		this.#logger?.debug(`Invoking ${handlerName}`);
		/** @type {{[moduleName: string]: R[]}} */
		const returnValues = Object.create(null);

		for (const [id, module] of this.#modules) {
			const handler = module[handlerName];

			if (handler) {
				try {
					returnValues[id] = /** @type {(...args: P) => any} */ (handler).apply(module, params);

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

	/**
	 * @param {lsp.InitializeParams} params
	 * @returns {lsp.InitializeResult}
	 */
	#onInitialize(params) {
		this.#logger?.debug('received onInitialize', { params });

		/** @type {lsp.InitializeResult} */
		const result = {
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

	/**
	 * @param {lsp.DidChangeConfigurationParams} params
	 * @returns {void}
	 */
	#onDidChangeConfiguration(params) {
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

		if (changed) {
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
	}
}

module.exports = {
	StylelintLanguageServer,
};
