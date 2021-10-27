'use strict';

jest.mock('../../utils/lsp');
jest.mock('../../utils/stylelint');
jest.mock('../../utils/documents');
jest.mock('../../utils/packages');

const { displayError } = /** @type {jest.Mocked<typeof import('../../utils/lsp')>} */ (
	require('../../utils/lsp')
);

const { StylelintRunner } = /** @type {jest.Mocked<typeof import('../../utils/stylelint')>} */ (
	require('../../utils/stylelint')
);

const { getFixes } = /** @type {jest.Mocked<typeof import('../../utils/documents')>} */ (
	require('../../utils/documents')
);

const { StylelintResolver } = /** @type {jest.Mocked<typeof import('../../utils/packages')>} */ (
	require('../../utils/packages')
);

const { StylelintLanguageServer } = require('../server');

const mockConnection = /** @type {jest.Mocked<lsp.Connection>} */ (
	/** @type {any} */ ({
		listen: jest.fn(),
		onInitialize: jest.fn(),
		onDidChangeConfiguration: jest.fn(),
		onDidChangeWatchedFiles: jest.fn(),
		sendDiagnostics: jest.fn(),
	})
);

const mockLogger = /** @type {jest.Mocked<winston.Logger>} */ (
	/** @type {any} */ ({
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		isDebugEnabled: jest.fn(),
		child: jest.fn(() => mockLogger),
	})
);

describe('StylelintLanguageServer', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('should be constructable', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
		});

		expect(server).toBeInstanceOf(StylelintLanguageServer);
	});

	test('should tag its own logger', () => {
		new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		expect(mockLogger.child).toHaveBeenCalledWith({
			component: 'language-server',
		});
	});

	test('should accept server modules', () => {
		class TestModule {
			/**
			 * @type {LanguageServerModuleConstructorParameters | undefined}
			 */
			static params;
			static id = 'test-module';

			/**
			 * @param {LanguageServerModuleConstructorParameters} params
			 */
			constructor(params) {
				TestModule.params = params;
			}
		}

		new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		expect(TestModule.params).toMatchSnapshot();
		expect(mockLogger.child).toHaveBeenCalledWith({
			component: 'language-server:test-module',
		});
	});

	test('should not accept modules with duplicate IDs', () => {
		class TestModule {
			static id = 'test-module';
		}

		class TestModule2 {
			static id = 'test-module';
		}

		expect(() => {
			new StylelintLanguageServer({
				connection: mockConnection,
				logger: mockLogger,
				modules: [TestModule, TestModule2],
			});
		}).toThrowErrorMatchingSnapshot();
	});

	test('should prevent modules from modifying context properties', () => {
		class TestModule {
			static id = 'test-module';

			/**
			 * @param {LanguageServerModuleConstructorParameters} context
			 */
			constructor({ context }) {
				context.connection = /** @type {any} */ ({});
			}
		}

		expect(() => {
			new StylelintLanguageServer({
				connection: mockConnection,
				logger: mockLogger,
				modules: [TestModule],
			});
		}).toThrowErrorMatchingSnapshot();
	});

	test('should not accept modules without an ID', () => {
		class TestModule {
			static id = undefined;
		}

		expect(() => {
			new StylelintLanguageServer({
				connection: mockConnection,
				logger: mockLogger,
				modules: [/** @type {any} */ (TestModule)],
			});
		}).toThrowErrorMatchingSnapshot();
	});

	test('should not accept modules with a non-string ID', () => {
		class TestModule {
			static id = 1;
		}

		expect(() => {
			new StylelintLanguageServer({
				connection: mockConnection,
				logger: mockLogger,
				modules: [/** @type {any} */ (TestModule)],
			});
		}).toThrowErrorMatchingSnapshot();
	});

	test('should start successfully', async () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.start();

		expect(mockLogger.info).toHaveBeenCalledWith('Language server started');
	});

	test('should combine initialization results from modules', () => {
		class TestModuleA {
			static id = 'module-a';

			/**
			 * @returns {Partial<lsp.InitializeResult>}
			 */
			onInitialize() {
				return {
					capabilities: { callHierarchyProvider: true },
				};
			}
		}

		class TestModuleB {
			static id = 'module-b';

			/**
			 * @returns {Partial<lsp.InitializeResult>}
			 */
			onInitialize() {
				return {
					capabilities: {
						typeDefinitionProvider: true,
						workspace: {
							workspaceFolders: {
								supported: true,
							},
						},
					},
				};
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModuleA, TestModuleB],
		});

		server.start();

		const handler = mockConnection.onInitialize.mock.calls[0][0];

		const result = handler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		expect(result).toMatchSnapshot();
	});

	test('should display and log errors thrown by module handlers', () => {
		const error = new Error('Test error');

		class TestModule {
			static id = 'test-module';

			/**
			 * @returns {Partial<lsp.InitializeResult>}
			 */
			onInitialize() {
				throw error;
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const handler = mockConnection.onInitialize.mock.calls[0][0];

		handler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		expect(displayError).toHaveBeenCalledWith(mockConnection, error);
		expect(mockLogger.error).toHaveBeenCalledWith('Error invoking onInitialize', {
			module: 'test-module',
			error,
		});
	});

	test('should allow modules to access sibling modules', () => {
		/**
		 * @type {LanguageServerModule | undefined}
		 */
		let module;

		class TestModuleA {
			static id = 'module-a';

			constructor() {
				this.value = 5;
			}
		}

		class TestModuleB {
			static id = 'module-b';

			/**
			 * @param {LanguageServerModuleConstructorParameters} params
			 */
			constructor({ context }) {
				this.context = context;
			}

			onInitialize() {
				module = this.context.getModule('module-a');
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModuleA, TestModuleB],
		});

		server.start();

		const handler = mockConnection.onInitialize.mock.calls[0][0];

		handler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		expect(module).toBeInstanceOf(TestModuleA);
		expect(module?.value).toBe(5);
	});

	test('should receive settings from the client and pass them to modules with defaults', () => {
		/**
		 * @type {LanguageServerOptions | undefined}
		 */
		let options;

		class TestModule {
			static id = 'test-module';

			/**
			 * @param {DidChangeConfigurationParams} params
			 */
			onDidChangeConfiguration({ settings }) {
				options = settings;
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		const onDidChangeConfigurationHandler =
			mockConnection.onDidChangeConfiguration.mock.calls[0][0];

		onDidChangeConfigurationHandler({ settings: { stylelint: {} } });

		expect(options).toMatchSnapshot();
	});

	test('should receive updates to settings from the client and pass them to modules', () => {
		/**
		 * @type {LanguageServerOptions | undefined}
		 */
		let options;

		class TestModule {
			static id = 'test-module';

			/**
			 * @param {DidChangeConfigurationParams} params
			 */
			onDidChangeConfiguration({ settings }) {
				options = settings;
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		const onDidChangeConfigurationHandler =
			mockConnection.onDidChangeConfiguration.mock.calls[0][0];

		onDidChangeConfigurationHandler({ settings: { stylelint: {} } });

		onDidChangeConfigurationHandler({
			settings: {
				stylelint: {
					config: {
						rules: {
							'block-no-empty': true,
						},
					},
					ignoreDisables: true,
				},
			},
		});

		expect(options).toMatchSnapshot();
	});

	test('should fire onDidChangeValidateLanguages when first settings are sent to server', () => {
		/**
		 * @type {LanguageServerOptions | undefined}
		 */
		let options;

		/**
		 * @type {DidChangeValidateLanguagesParams | undefined}
		 */
		let languageParams;

		class TestModule {
			static id = 'test-module';

			/**
			 * @param {DidChangeConfigurationParams} params
			 */
			onDidChangeConfiguration({ settings }) {
				options = settings;
			}

			/**
			 * @param {DidChangeValidateLanguagesParams} params
			 */
			onDidChangeValidateLanguages(params) {
				languageParams = params;
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		const onDidChangeConfigurationHandler =
			mockConnection.onDidChangeConfiguration.mock.calls[0][0];

		onDidChangeConfigurationHandler({ settings: { stylelint: {} } });

		expect(options).toMatchSnapshot();
		expect(languageParams).toMatchSnapshot();
	});

	test('should fire onDidChangeValidateLanguages when validate option changes', () => {
		/**
		 * @type {LanguageServerOptions | undefined}
		 */
		let options;

		/**
		 * @type {DidChangeValidateLanguagesParams | undefined}
		 */
		let languageParams;

		class TestModule {
			static id = 'test-module';

			/**
			 * @param {DidChangeConfigurationParams} params
			 */
			onDidChangeConfiguration({ settings }) {
				options = settings;
			}

			/**
			 * @param {DidChangeValidateLanguagesParams} params
			 */
			onDidChangeValidateLanguages(params) {
				languageParams = params;
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		const onDidChangeConfigurationHandler =
			mockConnection.onDidChangeConfiguration.mock.calls[0][0];

		onDidChangeConfigurationHandler({ settings: { stylelint: {} } });

		onDidChangeConfigurationHandler({
			settings: {
				stylelint: {
					validate: ['css'],
				},
			},
		});

		expect(options).toMatchSnapshot();
		expect(languageParams).toMatchSnapshot();
	});

	test('with debug log level, should log changed languages', () => {
		mockLogger.isDebugEnabled.mockReturnValue(true);
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.start();

		const onDidChangeConfigurationHandler =
			mockConnection.onDidChangeConfiguration.mock.calls[0][0];

		onDidChangeConfigurationHandler({
			settings: {
				stylelint: {
					validate: ['css'],
				},
			},
		});

		expect(mockLogger.debug).toHaveBeenCalledWith('Languages that should be validated changed', {
			languages: ['css'],
			removedLanguages: ['postcss'],
		});
	});

	test('without debug log level, should not log changed languages', () => {
		mockLogger.isDebugEnabled.mockReturnValue(false);
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.start();

		const onDidChangeConfigurationHandler =
			mockConnection.onDidChangeConfiguration.mock.calls[0][0];

		onDidChangeConfigurationHandler({
			settings: {
				stylelint: {
					validate: ['css'],
				},
			},
		});

		expect(mockLogger.debug).not.toHaveBeenCalledWith(
			'Languages that should be validated changed',
			{
				languages: ['css'],
				removedLanguages: ['postcss'],
			},
		);
	});

	test('should allow modules to lint documents using context.lintDocument', async () => {
		/** @type {Promise<any> | undefined} */
		let withOptions;

		/** @type {Promise<any> | undefined} */
		let withoutOptions;

		const mockRunner = {
			lintDocument: jest.fn(async () => ['test']),
		};

		StylelintRunner.mockImplementation(() => /** @type {any} */ (mockRunner));

		const document = /** @type {lsp.TextDocument} */ (
			/** @type {any} */ ({
				uri: 'file:///test.css',
			})
		);

		class TestModule {
			static id = 'test-module';

			/**
			 * @param {LanguageServerModuleConstructorParameters} params
			 */
			constructor({ context }) {
				this.context = context;
			}

			onInitialize() {
				withOptions = this.context.lintDocument(document, { maxWarnings: 1 });
				withoutOptions = this.context.lintDocument(document);
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		expect(await withOptions).toStrictEqual(['test']);
		expect(await withoutOptions).toStrictEqual(['test']);

		expect(mockRunner.lintDocument.mock.calls).toMatchSnapshot();
	});

	test('should display and log errors thrown when linting', async () => {
		const error = new Error('test');

		/** @type {Promise<any> | undefined} */
		let promise;

		StylelintRunner.mockImplementation(
			() =>
				/** @type {any} */ ({
					lintDocument: async () => {
						throw error;
					},
				}),
		);

		const document = /** @type {lsp.TextDocument} */ (
			/** @type {any} */ ({
				uri: 'file:///test.css',
			})
		);

		class TestModule {
			static id = 'test-module';

			/**
			 * @param {LanguageServerModuleConstructorParameters} params
			 */
			constructor({ context }) {
				this.context = context;
			}

			onInitialize() {
				promise = this.context.lintDocument(document, { maxWarnings: 1 });
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		expect(await promise).toBeUndefined();
		expect(displayError).toHaveBeenCalledWith(mockConnection, error);
		expect(mockLogger.error).toHaveBeenCalledWith('Error running lint', {
			uri: 'file:///test.css',
			error,
		});
	});

	test('should allow modules to get fixes for documents using context.getFixes', async () => {
		/** @type {Promise<any> | undefined} */
		let withOptions;

		/** @type {Promise<any> | undefined} */
		let withoutOptions;

		StylelintRunner.mockImplementation(() => /** @type {any} */ ({}));

		getFixes.mockImplementation(() => /** @type {any} */ (['test']));

		const document = /** @type {lsp.TextDocument} */ (
			/** @type {any} */ ({
				uri: 'file:///test.css',
			})
		);

		class TestModule {
			static id = 'test-module';

			/**
			 * @param {LanguageServerModuleConstructorParameters} params
			 */
			constructor({ context }) {
				this.context = context;
			}

			onInitialize() {
				withOptions = this.context.getFixes(document, { maxWarnings: 1 });
				withoutOptions = this.context.getFixes(document);
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		expect(await withOptions).toStrictEqual(['test']);
		expect(await withoutOptions).toStrictEqual(['test']);
		expect(getFixes.mock.calls).toMatchSnapshot();
	});

	test('should display and log errors thrown when getting fixes', async () => {
		const error = new Error('test');

		/** @type {Promise<any> | undefined} */
		let promise;

		getFixes.mockImplementation(() => {
			throw error;
		});

		const document = /** @type {lsp.TextDocument} */ (
			/** @type {any} */ ({
				uri: 'file:///test.css',
			})
		);

		class TestModule {
			static id = 'test-module';

			/**
			 * @param {LanguageServerModuleConstructorParameters} params
			 */
			constructor({ context }) {
				this.context = context;
			}

			onInitialize() {
				promise = this.context.getFixes(document, { maxWarnings: 1 });
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		expect(await promise).toStrictEqual([]);
		expect(displayError).toHaveBeenCalledWith(mockConnection, error);
		expect(mockLogger.error).toHaveBeenCalledWith('Error getting fixes', {
			uri: 'file:///test.css',
			error,
		});
	});

	test('should allow modules to resolve the Stylelint package for a given document using context.resolveStylelintPackage', async () => {
		/** @type {Promise<any> | undefined} */
		let promise;

		StylelintResolver.mockImplementation(
			() =>
				/** @type {any} */ ({
					resolve: async () => ({
						stylelint: { fake: 'package' },
						resolvedPath: 'fake/path',
					}),
				}),
		);

		const document = /** @type {lsp.TextDocument} */ (
			/** @type {any} */ ({
				uri: 'file:///test.css',
			})
		);

		class TestModule {
			static id = 'test-module';

			/**
			 * @param {LanguageServerModuleConstructorParameters} params
			 */
			constructor({ context }) {
				this.context = context;
			}

			onInitialize() {
				promise = this.context.resolveStylelint(document);
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		expect(await promise).toStrictEqual({
			stylelint: { fake: 'package' },
			resolvedPath: 'fake/path',
		});
	});

	test('should display and log errors thrown when resolving the Stylelint package', async () => {
		const error = new Error('test');

		/** @type {Promise<any> | undefined} */
		let promise;

		StylelintResolver.mockImplementation(
			() =>
				/** @type {any} */ ({
					resolve: async () => {
						throw error;
					},
				}),
		);

		const document = /** @type {lsp.TextDocument} */ (
			/** @type {any} */ ({
				uri: 'file:///test.css',
			})
		);

		class TestModule {
			static id = 'test-module';

			/**
			 * @param {LanguageServerModuleConstructorParameters} params
			 */
			constructor({ context }) {
				this.context = context;
			}

			onInitialize() {
				promise = this.context.resolveStylelint(document);
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		expect(await promise).toBeUndefined();
		expect(displayError).toHaveBeenCalledWith(mockConnection, error);
		expect(mockLogger.error).toHaveBeenCalledWith('Error resolving Stylelint', {
			uri: 'file:///test.css',
			error,
		});
	});

	test('should log when Stylelint cannot be resolved', async () => {
		/** @type {Promise<any> | undefined} */
		let promise;

		StylelintResolver.mockImplementation(
			() =>
				/** @type {any} */ ({
					resolve: async () => {
						return undefined;
					},
				}),
		);

		const document = /** @type {lsp.TextDocument} */ (
			/** @type {any} */ ({
				uri: 'file:///test.css',
			})
		);

		class TestModule {
			static id = 'test-module';

			/**
			 * @param {LanguageServerModuleConstructorParameters} params
			 */
			constructor({ context }) {
				this.context = context;
			}

			onInitialize() {
				promise = this.context.resolveStylelint(document);
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			/** @type {any} */ ({ capabilities: {} }),
			/** @type {any} */ ({}),
			/** @type {any} */ ({}),
		);

		expect(await promise).toBeUndefined();
		expect(mockLogger.warn).toHaveBeenCalledWith('Failed to resolve Stylelint', {
			uri: 'file:///test.css',
		});
	});
});
