jest.mock('vscode-languageserver/node');
jest.mock('../../utils/lsp');
jest.mock('../../utils/stylelint');
jest.mock('../../utils/documents');
jest.mock('../../utils/packages');

import {
	Connection,
	DidChangeConfigurationNotification,
	InitializedNotification,
	WorkDoneProgressReporter,
} from 'vscode-languageserver';
import type { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node';
import * as LSP from 'vscode-languageserver-protocol';
import { displayError, NotificationManager, CommandManager } from '../../utils/lsp';
import { StylelintRunner } from '../../utils/stylelint';
import { getFixes } from '../../utils/documents';
import { StylelintResolver } from '../../utils/packages';
import { StylelintLanguageServer } from '../server';
import {
	LanguageServerContext,
	LanguageServerModule,
	LanguageServerModuleConstructor,
	LanguageServerModuleConstructorParameters,
	Notification,
} from '../types';

const mockDisplayError = displayError as jest.MockedFunction<typeof displayError>;
const mockNotificationManager = NotificationManager as jest.MockedClass<typeof NotificationManager>;
const mockCommandManager = CommandManager as jest.MockedClass<typeof CommandManager>;
const mockRunner = StylelintRunner as jest.Mock<StylelintRunner>;
const mockGetFixes = getFixes as jest.MockedFunction<typeof getFixes>;
const mockResolver = StylelintResolver as jest.Mock<StylelintResolver>;
const mockTextDocuments = TextDocuments as jest.Mock<TextDocuments<TextDocument>>;

const mockConnection = serverMocks.getConnection();
const mockLogger = serverMocks.getLogger();
const mockNotifications = serverMocks.getNotificationManager();
const mockCommands = serverMocks.getCommandManager();

mockNotificationManager.mockImplementation(() => mockNotifications.__typed());
mockCommandManager.mockImplementation(() => mockCommands.__typed());

describe('StylelintLanguageServer', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		mockTextDocuments.mockReturnValue({
			listen: jest.fn(),
			onDidClose: jest.fn(),
		} as unknown as TextDocuments<TextDocument>);
	});

	test('should be constructable', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection.__typed(),
		});

		expect(server).toBeInstanceOf(StylelintLanguageServer);
	});

	test('should tag its own logger', () => {
		new StylelintLanguageServer({
			connection: mockConnection.__typed(),
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
			connection: mockConnection.__typed(),
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
				connection: mockConnection.__typed(),
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
				connection: mockConnection.__typed(),
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
				connection: mockConnection.__typed(),
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
				connection: mockConnection.__typed(),
				logger: mockLogger,
				modules: [TestModule as unknown as LanguageServerModuleConstructor],
			});
		}).toThrowErrorMatchingSnapshot();
	});

	test('should start successfully', async () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection.__typed(),
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
			connection: mockConnection.__typed(),
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

	test('if workspace/configuration is not supported, should not register DidChangeConfigurationNotification', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection.__typed(),
			logger: mockLogger,
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const onInitializedHandler = mockNotifications.on.mock.calls.find(
			(call) => call[0] === InitializedNotification.type,
		)[1];

		onInitializedHandler({});

		expect(mockLogger.debug).toHaveBeenCalledWith('received onInitialized', { params: {} });
		expect(mockLogger.debug).not.toHaveBeenCalledWith(
			'Registering DidChangeConfigurationNotification',
		);
		expect(mockConnection.client.register).not.toHaveBeenCalledWith(
			LSP.DidChangeConfigurationNotification.type,
		);
	});

	test('if workspace/configuration is supported, should register DidChangeConfigurationNotification', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection.__typed(),
			logger: mockLogger,
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const onInitializedHandler = mockNotifications.on.mock.calls.find(
			(call) => call[0] === InitializedNotification.type,
		)[1];

		onInitializedHandler({});

		expect(mockLogger.debug).toHaveBeenCalledWith('received onInitialized', { params: {} });
		expect(mockLogger.debug).toHaveBeenCalledWith('Registering DidChangeConfigurationNotification');
		expect(mockConnection.client.register).toHaveBeenCalledWith(
			LSP.DidChangeConfigurationNotification.type,
			{ section: 'stylelint' },
		);
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
			connection: mockConnection.__typed(),
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
			connection: mockConnection.__typed(),
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

	test('when workspace/configuration is not available, context.getOptions should return global options', async () => {
		let context: LanguageServerContext | undefined;

		class TestModule {
			static id = 'test-module';

			constructor(params: LanguageServerModuleConstructorParameters) {
				context = params.context;
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection.__typed(),
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

		const onDidChangeConfigurationHandler = mockNotifications.on.mock.calls.find(
			(call) => call[0] === DidChangeConfigurationNotification.type,
		)[1];

		onDidChangeConfigurationHandler({ settings: {} });

		const options = await context?.getOptions?.('uri');

		expect(mockConnection.workspace.getConfiguration).not.toHaveBeenCalled();
		expect(options).toMatchSnapshot();
	});

	test('when workspace/configuration is not available, context.getOptions should gracefully handle missing section', async () => {
		let context: LanguageServerContext | undefined;

		class TestModule {
			static id = 'test-module';

			constructor(params: LanguageServerModuleConstructorParameters) {
				context = params.context;
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection.__typed(),
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

		const initialOptions = await context?.getOptions?.('uri');

		const onDidChangeConfigurationHandler = mockNotifications.on.mock.calls.find(
			(call) => call[0] === DidChangeConfigurationNotification.type,
		)[1];

		onDidChangeConfigurationHandler({
			settings: {
				stylelint: {
					validate: ['css'],
				},
			},
		});

		const changedOptions = await context?.getOptions?.('uri');

		expect(mockConnection.workspace.getConfiguration).not.toHaveBeenCalled();
		expect(initialOptions).toMatchSnapshot();
		expect(changedOptions).toMatchSnapshot();
	});

	test('when workspace/configuration is available, context.getOptions should return resource-scoped options', async () => {
		mockConnection.workspace.getConfiguration.mockImplementation(
			({ scopeUri, section }: LSP.ConfigurationItem) => {
				if (section !== 'stylelint') {
					return {};
				}

				return scopeUri === 'uri'
					? { packageManager: 'yarn' }
					: { packageManager: 'npm', snippet: ['scss'] };
			},
		);

		let context: LanguageServerContext | undefined;

		class TestModule {
			static id = 'test-module';

			constructor(params: LanguageServerModuleConstructorParameters) {
				context = params.context;
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection.__typed(),
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const options1 = await context?.getOptions?.('uri');
		const options2 = await context?.getOptions?.('uri2');

		expect(mockConnection.workspace.getConfiguration).toHaveBeenCalledWith({
			scopeUri: 'uri',
			section: 'stylelint',
		});
		expect(mockConnection.workspace.getConfiguration).toHaveBeenCalledWith({
			scopeUri: 'uri2',
			section: 'stylelint',
		});
		expect(options1).toMatchSnapshot();
		expect(options2).toMatchSnapshot();
	});

	test('when workspace/configuration is available, context.getOptions should cache resource-scoped options', async () => {
		mockConnection.workspace.getConfiguration.mockImplementation(
			({ scopeUri, section }: LSP.ConfigurationItem) => {
				if (section !== 'stylelint') {
					return {};
				}

				return scopeUri === 'uri'
					? { packageManager: 'yarn' }
					: { packageManager: 'npm', snippet: ['scss'] };
			},
		);

		let context: LanguageServerContext | undefined;

		class TestModule {
			static id = 'test-module';

			constructor(params: LanguageServerModuleConstructorParameters) {
				context = params.context;
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection.__typed(),
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const options1A = await context?.getOptions?.('uri');
		const options1B = await context?.getOptions?.('uri');
		const options2A = await context?.getOptions?.('uri2');
		const options2B = await context?.getOptions?.('uri2');

		expect(mockConnection.workspace.getConfiguration).toHaveBeenCalledTimes(2);
		expect(options1A).toEqual(options1B);
		expect(options2A).toEqual(options2B);
	});

	test('when workspace/configuration is available, on documents.onDidClose, should clear cached options', async () => {
		mockConnection.workspace.getConfiguration.mockImplementation(
			({ scopeUri, section }: LSP.ConfigurationItem) => {
				if (section !== 'stylelint') {
					return {};
				}

				return scopeUri === 'uri'
					? { packageManager: 'yarn' }
					: { packageManager: 'npm', snippet: ['scss'] };
			},
		);

		let context: LanguageServerContext | undefined;

		class TestModule {
			static id = 'test-module';

			constructor(params: LanguageServerModuleConstructorParameters) {
				context = params.context;
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection.__typed(),
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const options1A = await context?.getOptions?.('uri');
		const options1B = await context?.getOptions?.('uri');
		const options2A = await context?.getOptions?.('uri2');
		const options2B = await context?.getOptions?.('uri2');

		const onDidCloseHandler = mockTextDocuments.mock.results[0].value.onDidClose.mock.calls[0][0];

		onDidCloseHandler({ document: { uri: 'uri' } });

		const options1C = await context?.getOptions?.('uri');
		const options2C = await context?.getOptions?.('uri2');

		expect(mockConnection.workspace.getConfiguration).toHaveBeenCalledTimes(3);
		expect(options1A).toEqual(options1B);
		expect(options1A).toEqual(options1C);
		expect(options2A).toEqual(options2B);
		expect(options2A).toEqual(options2C);
	});

	test('when workspace/configuration is available, onDidChangeConfiguration should clear all cached options', async () => {
		let context: LanguageServerContext | undefined;

		class TestModule {
			static id = 'test-module';

			constructor(params: LanguageServerModuleConstructorParameters) {
				context = params.context;
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection.__typed(),
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const options1A = await context?.getOptions?.('uri');
		const options1B = await context?.getOptions?.('uri');
		const options2A = await context?.getOptions?.('uri2');
		const options2B = await context?.getOptions?.('uri2');

		const onDidChangeConfigurationHandler = mockNotifications.on.mock.calls.find(
			(call) => call[0] === DidChangeConfigurationNotification.type,
		)[1];

		onDidChangeConfigurationHandler({
			settings: {
				stylelint: {
					validate: ['css'],
				},
			},
		});

		const options1C = await context?.getOptions?.('uri');
		const options2C = await context?.getOptions?.('uri2');

		expect(mockConnection.workspace.getConfiguration).toHaveBeenCalledTimes(4);
		expect(options1A).toEqual(options1B);
		expect(options1A).toEqual(options1C);
		expect(options2A).toEqual(options2B);
		expect(options2A).toEqual(options2C);
	});

	test('when workspace/configuration is available, onDidChangeConfiguration should fire module handlers', async () => {
		const moduleHandler = jest.fn();

		class TestModule {
			static id = 'test-module';

			onDidChangeConfiguration = moduleHandler;
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection.__typed(),
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const onDidChangeConfigurationHandler = mockNotifications.on.mock.calls.find(
			(call) => call[0] === DidChangeConfigurationNotification.type,
		)[1];

		onDidChangeConfigurationHandler({
			settings: {
				stylelint: {
					validate: ['css'],
				},
			},
		});

		expect(moduleHandler).toHaveBeenCalledTimes(1);
		expect(moduleHandler).toHaveBeenCalledWith();
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
			connection: mockConnection.__typed(),
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

	test('when workspace/configuration is available, onDidChangeConfiguration should send the DidResetConfiguration notification', async () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection.__typed(),
			logger: mockLogger,
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const onDidChangeConfigurationHandler = mockNotifications.on.mock.calls.find(
			(call) => call[0] === DidChangeConfigurationNotification.type,
		)[1];

		onDidChangeConfigurationHandler({
			settings: {
				stylelint: {
					validate: ['css'],
				},
			},
		});

		expect(mockConnection.sendNotification).toHaveBeenCalledWith(
			Notification.DidResetConfiguration,
		);
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
			connection: mockConnection.__typed(),
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
			connection: mockConnection.__typed(),
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
			connection: mockConnection.__typed(),
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
			connection: mockConnection.__typed(),
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
			connection: mockConnection.__typed(),
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
			connection: mockConnection.__typed(),
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
