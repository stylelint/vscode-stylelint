jest.mock('../../utils/lsp');
jest.mock('../../utils/stylelint');
jest.mock('../../utils/documents');
jest.mock('../../utils/packages');

import type { Connection, WorkDoneProgressReporter } from 'vscode-languageserver';
import type { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import type LSP from 'vscode-languageserver-protocol';
import type winston from 'winston';
import { displayError } from '../../utils/lsp';
import { StylelintRunner } from '../../utils/stylelint';
import { getFixes } from '../../utils/documents';
import { StylelintResolver } from '../../utils/packages';
import { StylelintLanguageServer } from '../server';
import type {
	DidChangeConfigurationParams,
	DidChangeValidateLanguagesParams,
	LanguageServerContext,
	LanguageServerModule,
	LanguageServerModuleConstructor,
	LanguageServerModuleConstructorParameters,
	LanguageServerOptions,
} from '../types';

const mockDisplayError = displayError as jest.MockedFunction<typeof displayError>;
const mockRunner = StylelintRunner as jest.Mock<StylelintRunner>;
const mockGetFixes = getFixes as jest.MockedFunction<typeof getFixes>;
const mockResolver = StylelintResolver as jest.Mock<StylelintResolver>;

const mockConnection = {
	listen: jest.fn(),
	onInitialize: jest.fn(),
	onDidChangeConfiguration: jest.fn(),
	onDidChangeWatchedFiles: jest.fn(),
	sendDiagnostics: jest.fn(),
} as unknown as jest.Mocked<Connection>;

const mockLogger = {
	debug: jest.fn(),
	error: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	isDebugEnabled: jest.fn(),
	child: jest.fn(() => mockLogger),
} as unknown as jest.Mocked<winston.Logger>;

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
			static params: LanguageServerModuleConstructorParameters | undefined;
			static id = 'test-module';

			constructor(params: LanguageServerModuleConstructorParameters) {
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

			constructor({ context }: LanguageServerModuleConstructorParameters) {
				context.connection = {} as unknown as Connection;
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
				modules: [TestModule as unknown as LanguageServerModuleConstructor],
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
				modules: [TestModule as unknown as LanguageServerModuleConstructor],
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

			onInitialize(): Partial<LSP.InitializeResult> {
				return {
					capabilities: { callHierarchyProvider: true },
				};
			}
		}

		class TestModuleB {
			static id = 'module-b';

			onInitialize(): Partial<LSP.InitializeResult> {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(result).toMatchSnapshot();
	});

	test('should display and log errors thrown by module handlers', () => {
		const error = new Error('Test error');

		class TestModule {
			static id = 'test-module';

			onInitialize(): Partial<LSP.InitializeResult> {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(mockDisplayError).toHaveBeenCalledWith(mockConnection, error);
		expect(mockLogger.error).toHaveBeenCalledWith('Error invoking onInitialize', {
			module: 'test-module',
			error,
		});
	});

	test('should allow modules to access sibling modules', () => {
		let module: LanguageServerModule | undefined;

		class TestModuleA {
			static id = 'module-a';
			value = 5;
		}

		class TestModuleB {
			static id = 'module-b';
			context: LanguageServerContext;

			constructor({ context }: LanguageServerModuleConstructorParameters) {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(module).toBeInstanceOf(TestModuleA);
		expect(module?.value).toBe(5);
	});

	test('should receive settings from the client and pass them to modules with defaults', () => {
		let options: LanguageServerOptions | undefined;

		class TestModule {
			static id = 'test-module';

			onDidChangeConfiguration({ settings }: DidChangeConfigurationParams) {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const onDidChangeConfigurationHandler =
			mockConnection.onDidChangeConfiguration.mock.calls[0][0];

		onDidChangeConfigurationHandler({ settings: { stylelint: {} } });

		expect(options).toMatchSnapshot();
	});

	test('should receive updates to settings from the client and pass them to modules', () => {
		let options: LanguageServerOptions | undefined;

		class TestModule {
			static id = 'test-module';

			onDidChangeConfiguration({ settings }: DidChangeConfigurationParams) {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
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
		let options: LanguageServerOptions | undefined;
		let languageParams: DidChangeValidateLanguagesParams | undefined;

		class TestModule {
			static id = 'test-module';

			onDidChangeConfiguration({ settings }: DidChangeConfigurationParams) {
				options = settings;
			}

			onDidChangeValidateLanguages(params: DidChangeValidateLanguagesParams) {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const onDidChangeConfigurationHandler =
			mockConnection.onDidChangeConfiguration.mock.calls[0][0];

		onDidChangeConfigurationHandler({ settings: { stylelint: {} } });

		expect(options).toMatchSnapshot();
		expect(languageParams).toMatchSnapshot();
	});

	test('should fire onDidChangeValidateLanguages when validate option changes', () => {
		let options: LanguageServerOptions | undefined;
		let languageParams: DidChangeValidateLanguagesParams | undefined;

		class TestModule {
			static id = 'test-module';

			onDidChangeConfiguration({ settings }: DidChangeConfigurationParams) {
				options = settings;
			}

			onDidChangeValidateLanguages(params: DidChangeValidateLanguagesParams) {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
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
		let withOptions: Promise<unknown> | undefined;
		let withoutOptions: Promise<unknown> | undefined;

		const mockRunnerImpl = {
			lintDocument: jest.fn(async () => ['test']),
		} as unknown as jest.Mocked<StylelintRunner>;

		mockRunner.mockImplementation(() => mockRunnerImpl);

		const document = { uri: 'file:///test.css' } as TextDocument;

		class TestModule {
			static id = 'test-module';
			context: LanguageServerContext;

			constructor({ context }: LanguageServerModuleConstructorParameters) {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(await withOptions).toStrictEqual(['test']);
		expect(await withoutOptions).toStrictEqual(['test']);

		expect(mockRunnerImpl.lintDocument.mock.calls).toMatchSnapshot();
	});

	test('should display and log errors thrown when linting', async () => {
		const error = new Error('test');
		let promise: Promise<unknown> | undefined;

		mockRunner.mockImplementation(
			() =>
				({
					lintDocument: async () => {
						throw error;
					},
				} as unknown as StylelintRunner),
		);

		const document = { uri: 'file:///test.css' } as TextDocument;

		class TestModule {
			static id = 'test-module';
			context: LanguageServerContext;

			constructor({ context }: LanguageServerModuleConstructorParameters) {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(await promise).toBeUndefined();
		expect(mockDisplayError).toHaveBeenCalledWith(mockConnection, error);
		expect(mockLogger.error).toHaveBeenCalledWith('Error running lint', {
			uri: 'file:///test.css',
			error,
		});
	});

	test('should allow modules to get fixes for documents using context.getFixes', async () => {
		let withOptions: Promise<unknown> | undefined;
		let withoutOptions: Promise<unknown> | undefined;

		mockRunner.mockImplementation(() => ({} as unknown as StylelintRunner));
		mockGetFixes.mockImplementation(async () => ['test'] as unknown as TextEdit[]);

		const document = { uri: 'file:///test.css' } as TextDocument;

		class TestModule {
			static id = 'test-module';
			context: LanguageServerContext;

			constructor({ context }: LanguageServerModuleConstructorParameters) {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(await withOptions).toStrictEqual(['test']);
		expect(await withoutOptions).toStrictEqual(['test']);
		expect(mockGetFixes.mock.calls).toMatchSnapshot();
	});

	test('should display and log errors thrown when getting fixes', async () => {
		const error = new Error('test');
		let promise: Promise<unknown> | undefined;

		mockGetFixes.mockImplementation(() => {
			throw error;
		});

		const document = { uri: 'file:///test.css' } as TextDocument;

		class TestModule {
			static id = 'test-module';
			context: LanguageServerContext;

			constructor({ context }: LanguageServerModuleConstructorParameters) {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(await promise).toStrictEqual([]);
		expect(mockDisplayError).toHaveBeenCalledWith(mockConnection, error);
		expect(mockLogger.error).toHaveBeenCalledWith('Error getting fixes', {
			uri: 'file:///test.css',
			error,
		});
	});

	test('should allow modules to resolve the Stylelint package for a given document using context.resolveStylelintPackage', async () => {
		let promise: Promise<unknown> | undefined;

		mockResolver.mockImplementation(
			() =>
				({
					resolve: async () => ({
						stylelint: { fake: 'package' },
						resolvedPath: 'fake/path',
					}),
				} as unknown as StylelintResolver),
		);

		const document = { uri: 'file:///test.css' } as TextDocument;

		class TestModule {
			static id = 'test-module';
			context: LanguageServerContext;

			constructor({ context }: LanguageServerModuleConstructorParameters) {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(await promise).toStrictEqual({
			stylelint: { fake: 'package' },
			resolvedPath: 'fake/path',
		});
	});

	test('should display and log errors thrown when resolving the Stylelint package', async () => {
		const error = new Error('test');
		let promise: Promise<unknown> | undefined;

		mockResolver.mockImplementation(
			() =>
				({
					resolve: async () => {
						throw error;
					},
				} as unknown as StylelintResolver),
		);

		const document = { uri: 'file:///test.css' } as TextDocument;

		class TestModule {
			static id = 'test-module';
			context: LanguageServerContext;

			constructor({ context }: LanguageServerModuleConstructorParameters) {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(await promise).toBeUndefined();
		expect(mockDisplayError).toHaveBeenCalledWith(mockConnection, error);
		expect(mockLogger.error).toHaveBeenCalledWith('Error resolving Stylelint', {
			uri: 'file:///test.css',
			error,
		});
	});

	test('should log when Stylelint cannot be resolved', async () => {
		let promise: Promise<unknown> | undefined;

		mockResolver.mockImplementation(
			() =>
				({
					resolve: async () => {
						return undefined;
					},
				} as unknown as StylelintResolver),
		);

		const document = { uri: 'file:///test.css' } as TextDocument;

		class TestModule {
			static id = 'test-module';
			context: LanguageServerContext;

			constructor({ context }: LanguageServerModuleConstructorParameters) {
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
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(await promise).toBeUndefined();
		expect(mockLogger.warn).toHaveBeenCalledWith('Failed to resolve Stylelint', {
			uri: 'file:///test.css',
		});
	});
});
