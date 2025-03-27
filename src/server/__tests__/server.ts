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
import { displayError, NotificationManager, CommandManager } from '../../utils/lsp/index';
import { LintDiagnostics, StylelintRunner } from '../../utils/stylelint/index';
import { getEditInfo, getFixes } from '../../utils/documents/index';
import { StylelintResolver } from '../../utils/packages/index';
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
const mockGetEditInfo = getEditInfo as jest.MockedFunction<typeof getEditInfo>;
const mockResolver = StylelintResolver as jest.Mock<StylelintResolver>;
const mockTextDocuments = TextDocuments as jest.Mock<TextDocuments<TextDocument>>;

const mockConnection = serverMocks.getConnection();
const mockLogger = serverMocks.getLogger();
const mockNotifications = serverMocks.getNotificationManager();
const mockCommands = serverMocks.getCommandManager();
const mockDocuments = serverMocks.getTextDocuments();

mockNotificationManager.mockImplementation(() => mockNotifications.__typed());
mockCommandManager.mockImplementation(() => mockCommands.__typed());
mockTextDocuments.mockImplementation(() => mockDocuments.__typed());

abstract class BaseDisposable implements LSP.Disposable {
	public dispose(): void {
		// noop
	}
}

const getContextModule = (
	id = 'test-module',
): [LanguageServerModuleConstructor, () => LanguageServerContext | undefined] => {
	let context: LanguageServerContext | undefined;

	class TestModule extends BaseDisposable implements LanguageServerModule {
		static id = id;

		constructor(params: LanguageServerModuleConstructorParameters) {
			super();
			context = params.context;
		}
	}

	return [TestModule, () => context];
};

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
		class TestModule extends BaseDisposable {
			static params: LanguageServerModuleConstructorParameters | undefined;
			static id = 'test-module';

			constructor(params: LanguageServerModuleConstructorParameters) {
				super();
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
		class TestModule extends BaseDisposable {
			static id = 'test-module';
		}

		class TestModule2 extends BaseDisposable {
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
		class TestModule extends BaseDisposable {
			static id = 'test-module';

			constructor({ context }: LanguageServerModuleConstructorParameters) {
				super();
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
		class TestModule extends BaseDisposable {
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
		class TestModule extends BaseDisposable {
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
		class TestModuleA extends BaseDisposable {
			static id = 'module-a';

			onInitialize(): Partial<LSP.InitializeResult> {
				return {
					capabilities: { callHierarchyProvider: true },
				};
			}
		}

		class TestModuleB extends BaseDisposable {
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

	test('if workspace/configuration is not supported, should not register DidChangeConfigurationNotification', async () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const onInitializedHandler = mockNotifications.on.mock.calls.find(
			([type]) => type === InitializedNotification.type,
		)?.[1];

		await onInitializedHandler?.({});

		expect(mockLogger.debug).toHaveBeenCalledWith('received onInitialized', {
			params: {},
		});
		expect(mockLogger.debug).not.toHaveBeenCalledWith(
			'Registering DidChangeConfigurationNotification',
		);
		expect(mockConnection.client.register).not.toHaveBeenCalledWith(
			LSP.DidChangeConfigurationNotification.type,
		);
	});

	test('if workspace/configuration is supported, should register DidChangeConfigurationNotification', async () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const onInitializedHandler = mockNotifications.on.mock.calls.find(
			([type]) => type === InitializedNotification.type,
		)?.[1];

		await onInitializedHandler?.({});

		expect(mockLogger.debug).toHaveBeenCalledWith('received onInitialized', {
			params: {},
		});
		expect(mockLogger.debug).toHaveBeenCalledWith('Registering DidChangeConfigurationNotification');
		expect(mockConnection.client.register).toHaveBeenCalledWith(
			LSP.DidChangeConfigurationNotification.type,
			{ section: 'stylelint' },
		);
	});

	test('should display and log errors thrown by module handlers', async () => {
		const error = new Error('Test error');

		class TestModule extends BaseDisposable {
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

		await handler(
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

	test('should allow modules to access sibling modules', async () => {
		class TestModuleA extends BaseDisposable {
			static id = 'module-a';
			value = 5;
		}

		const [TestModuleB, getContext] = getContextModule('module-b');

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModuleA, TestModuleB],
		});

		server.start();

		const handler = mockConnection.onInitialize.mock.calls[0][0];

		await handler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const module = getContext()?.getModule('module-a');

		expect(module).toBeInstanceOf(TestModuleA);
		expect(module?.value).toBe(5);
	});

	test('when workspace/configuration is not available, context.getOptions should return global options', async () => {
		const [TestModule, getContext] = getContextModule();

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const onDidChangeConfigurationHandler = mockNotifications.on.mock.calls.find(
			([type]) => type === DidChangeConfigurationNotification.type,
		)?.[1];

		await onDidChangeConfigurationHandler?.({ settings: {} });

		const options = await getContext()?.getOptions?.('uri');

		expect(mockConnection.workspace.getConfiguration).not.toHaveBeenCalled();
		expect(options).toMatchSnapshot();
	});

	test('when workspace/configuration is not available, context.getOptions should gracefully handle missing section', async () => {
		const [TestModule, getContext] = getContextModule();

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const initialOptions = await getContext()?.getOptions?.('uri');

		const onDidChangeConfigurationHandler = mockNotifications.on.mock.calls.find(
			([type]) => type === DidChangeConfigurationNotification.type,
		)?.[1];

		await onDidChangeConfigurationHandler?.({
			settings: {
				stylelint: {
					validate: ['css'],
				},
			},
		});

		const changedOptions = await getContext()?.getOptions?.('uri');

		expect(mockConnection.workspace.getConfiguration).not.toHaveBeenCalled();
		expect(initialOptions).toMatchSnapshot();
		expect(changedOptions).toMatchSnapshot();
	});

	test('when workspace/configuration is available, context.getOptions should return resource-scoped options', async () => {
		const [TestModule, getContext] = getContextModule();

		mockConnection.workspace.getConfiguration.mockImplementation(
			async (params: string | LSP.ConfigurationItem | LSP.ConfigurationItem[]) => {
				const { scopeUri, section } = params as LSP.ConfigurationItem;

				if (section !== 'stylelint') {
					return {};
				}

				return scopeUri === 'uri'
					? { packageManager: 'yarn' }
					: { packageManager: 'npm', snippet: ['scss'] };
			},
		);

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const options1 = await getContext()?.getOptions?.('uri');
		const options2 = await getContext()?.getOptions?.('uri2');

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
			async (params: string | LSP.ConfigurationItem | LSP.ConfigurationItem[]) => {
				const { scopeUri, section } = params as LSP.ConfigurationItem;

				if (section !== 'stylelint') {
					return {};
				}

				return scopeUri === 'uri'
					? { packageManager: 'yarn' }
					: { packageManager: 'npm', snippet: ['scss'] };
			},
		);

		const [TestModule, getContext] = getContextModule();

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const options1A = await getContext()?.getOptions?.('uri');
		const options1B = await getContext()?.getOptions?.('uri');
		const options2A = await getContext()?.getOptions?.('uri2');
		const options2B = await getContext()?.getOptions?.('uri2');

		expect(mockConnection.workspace.getConfiguration).toHaveBeenCalledTimes(2);
		expect(options1A).toEqual(options1B);
		expect(options2A).toEqual(options2B);
	});

	test('when workspace/configuration is available, on documents.onDidClose, should clear cached options', async () => {
		mockConnection.workspace.getConfiguration.mockImplementation(
			async (params: string | LSP.ConfigurationItem | LSP.ConfigurationItem[]) => {
				const { scopeUri, section } = params as LSP.ConfigurationItem;

				if (section !== 'stylelint') {
					return {};
				}

				return scopeUri === 'uri'
					? { packageManager: 'yarn' }
					: { packageManager: 'npm', snippet: ['scss'] };
			},
		);

		const [TestModule, getContext] = getContextModule();

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const options1A = await getContext()?.getOptions?.('uri');
		const options1B = await getContext()?.getOptions?.('uri');
		const options2A = await getContext()?.getOptions?.('uri2');
		const options2B = await getContext()?.getOptions?.('uri2');

		const onDidCloseHandler = mockTextDocuments.mock.results[0].value.onDidClose.mock.calls[0][0];

		onDidCloseHandler({ document: { uri: 'uri' } });

		const options1C = await getContext()?.getOptions?.('uri');
		const options2C = await getContext()?.getOptions?.('uri2');

		expect(mockConnection.workspace.getConfiguration).toHaveBeenCalledTimes(3);
		expect(options1A).toEqual(options1B);
		expect(options1A).toEqual(options1C);
		expect(options2A).toEqual(options2B);
		expect(options2A).toEqual(options2C);
	});

	test('when workspace/configuration is available, onDidChangeConfiguration should clear all cached options', async () => {
		const [TestModule, getContext] = getContextModule();

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const options1A = await getContext()?.getOptions?.('uri');
		const options1B = await getContext()?.getOptions?.('uri');
		const options2A = await getContext()?.getOptions?.('uri2');
		const options2B = await getContext()?.getOptions?.('uri2');

		const onDidChangeConfigurationHandler = mockNotifications.on.mock.calls.find(
			([type]) => type === DidChangeConfigurationNotification.type,
		)?.[1];

		await onDidChangeConfigurationHandler?.({
			settings: {
				stylelint: {
					validate: ['css'],
				},
			},
		});

		const options1C = await getContext()?.getOptions?.('uri');
		const options2C = await getContext()?.getOptions?.('uri2');

		expect(mockConnection.workspace.getConfiguration).toHaveBeenCalledTimes(4);
		expect(options1A).toEqual(options1B);
		expect(options1A).toEqual(options1C);
		expect(options2A).toEqual(options2B);
		expect(options2A).toEqual(options2C);
	});

	test('when workspace/configuration is available, onDidChangeConfiguration should fire module handlers', async () => {
		const moduleHandler = jest.fn();

		class TestModule extends BaseDisposable {
			static id = 'test-module';

			onDidChangeConfiguration = moduleHandler;
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const onDidChangeConfigurationHandler = mockNotifications.on.mock.calls.find(
			([type]) => type === DidChangeConfigurationNotification.type,
		)?.[1];

		await onDidChangeConfigurationHandler?.({
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
		const mockRunnerImpl = serverMocks.getStylelintRunner();

		mockRunnerImpl.lintDocument.mockResolvedValue(['test'] as unknown as LintDiagnostics);
		mockRunner.mockImplementation(() => mockRunnerImpl.__typed());

		const document = { uri: 'file:///test.css' } as TextDocument;
		const [TestModule, getContext] = getContextModule();
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const withOptions = await getContext()?.lintDocument(document, {
			maxWarnings: 1,
		});
		const withoutOptions = await getContext()?.lintDocument(document);

		expect(withOptions).toStrictEqual(['test']);
		expect(withoutOptions).toStrictEqual(['test']);

		expect(mockRunnerImpl.lintDocument.mock.calls).toMatchSnapshot();
	});

	test('when workspace/configuration is available, onDidChangeConfiguration should send the DidResetConfiguration notification', async () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{
				capabilities: {
					workspace: { configuration: true },
				},
			} as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const onDidChangeConfigurationHandler = mockNotifications.on.mock.calls.find(
			([type]) => type === DidChangeConfigurationNotification.type,
		)?.[1];

		await onDidChangeConfigurationHandler?.({
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

		mockRunner.mockImplementation(
			() =>
				({
					lintDocument: async () => {
						throw error;
					},
				}) as unknown as StylelintRunner,
		);

		const document = { uri: 'file:///test.css' } as TextDocument;
		const [TestModule, getContext] = getContextModule();
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const results = await getContext()?.lintDocument(document, {
			maxWarnings: 1,
		});

		expect(results).toBeUndefined();
		expect(mockDisplayError).toHaveBeenCalledWith(mockConnection, error);
		expect(mockLogger.error).toHaveBeenCalledWith('Error running lint', {
			uri: 'file:///test.css',
			error,
		});
	});

	test('should allow modules to get fixes for documents using context.getFixes', async () => {
		mockRunner.mockImplementation(() => ({}) as unknown as StylelintRunner);
		mockGetFixes.mockImplementation(async () => ['test'] as unknown as TextEdit[]);

		const document = { uri: 'file:///test.css' } as TextDocument;
		const [TestModule, getContext] = getContextModule();
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const withOptions = await getContext()?.getFixes(document, {
			maxWarnings: 1,
		});
		const withoutOptions = await getContext()?.getFixes(document);

		expect(withOptions).toStrictEqual(['test']);
		expect(withoutOptions).toStrictEqual(['test']);
		expect(mockGetFixes.mock.calls).toMatchSnapshot();
	});

	test('should display and log errors thrown when getting fixes', async () => {
		const error = new Error('test');

		mockGetFixes.mockImplementation(() => {
			throw error;
		});

		const document = { uri: 'file:///test.css' } as TextDocument;
		const [TestModule, getContext] = getContextModule();
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const fixes = await getContext()?.getFixes(document, { maxWarnings: 1 });

		expect(fixes).toStrictEqual([]);
		expect(mockDisplayError).toHaveBeenCalledWith(mockConnection, error);
		expect(mockLogger.error).toHaveBeenCalledWith('Error getting fixes', {
			uri: 'file:///test.css',
			error,
		});
	});

	test('should allow modules to resolve the Stylelint package for a given document using context.resolveStylelintPackage', async () => {
		mockResolver.mockImplementation(
			() =>
				({
					resolve: async () => ({
						stylelint: { fake: 'package' },
						resolvedPath: 'fake/path',
					}),
				}) as unknown as StylelintResolver,
		);

		const document = { uri: 'file:///test.css' } as TextDocument;
		const [TestModule, getContext] = getContextModule();
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const resolved = await getContext()?.resolveStylelint(document);

		expect(resolved).toStrictEqual({
			stylelint: { fake: 'package' },
			resolvedPath: 'fake/path',
		});
	});

	test('should display and log errors thrown when resolving the Stylelint package', async () => {
		const error = new Error('test');

		mockResolver.mockImplementation(
			() =>
				({
					resolve: async () => {
						throw error;
					},
				}) as unknown as StylelintResolver,
		);

		const document = { uri: 'file:///test.css' } as TextDocument;
		const [TestModule, getContext] = getContextModule();
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const resolved = await getContext()?.resolveStylelint(document);

		expect(resolved).toBeUndefined();
		expect(mockDisplayError).toHaveBeenCalledWith(mockConnection, error);
		expect(mockLogger.error).toHaveBeenCalledWith('Error resolving Stylelint', {
			uri: 'file:///test.css',
			error,
		});
	});

	test('should log when Stylelint cannot be resolved', async () => {
		mockResolver.mockImplementation(
			() =>
				({
					resolve: async () => {
						return undefined;
					},
				}) as unknown as StylelintResolver,
		);

		const document = { uri: 'file:///test.css' } as TextDocument;
		const [TestModule, getContext] = getContextModule();
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const resolved = await getContext()?.resolveStylelint(document);

		expect(resolved).toBeUndefined();
		expect(mockLogger.warn).toHaveBeenCalledWith('Failed to resolve Stylelint', {
			uri: 'file:///test.css',
		});
	});

	it('should be disposable', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		expect(server).toHaveProperty('dispose');
		expect(server.dispose).toBeInstanceOf(Function);
	});

	it('should log when disposing', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.dispose();

		expect(mockLogger.info).toHaveBeenCalledWith('Stopping language server');
	});

	it('should dispose all modules when disposed', () => {
		const funcs: jest.Mock[] = [];

		class TestModuleA extends BaseDisposable {
			static id = 'module-a';

			constructor() {
				const dispose = jest.fn();

				super();
				funcs.push(dispose);
				this.dispose = dispose;
			}
		}

		class TestModuleB extends BaseDisposable {
			static id = 'module-b';

			constructor() {
				const dispose = jest.fn();

				super();
				funcs.push(dispose);
				this.dispose = dispose;
			}
		}

		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
			modules: [TestModuleA, TestModuleB],
		});

		server.dispose();

		expect(funcs).toHaveLength(2);
		expect(funcs[0]).toHaveBeenCalledTimes(1);
		expect(funcs[1]).toHaveBeenCalledTimes(1);
	});

	it('should set a no-op InitializeRequest handler when disposed', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.dispose();

		expect(mockConnection.onInitialize).toHaveBeenCalledTimes(1);
		expect(mockConnection.onInitialize.mock.calls[0][0]).toBeInstanceOf(Function);
		expect(
			mockConnection.onInitialize.mock.calls[0][0](
				{
					rootUri: '',
					capabilities: {},
					processId: 1,
					workspaceFolders: [],
				},
				{} as LSP.CancellationToken,
				{} as WorkDoneProgressReporter,
			),
		).toStrictEqual({
			capabilities: {},
		});
	});

	it('should set a no-op ShutdownRequest handler when disposed', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.dispose();

		expect(mockConnection.onShutdown).toHaveBeenCalledTimes(1);
		expect(mockConnection.onShutdown.mock.calls[0][0]).toBeInstanceOf(Function);
		expect(mockConnection.onShutdown.mock.calls[0][0]({} as LSP.CancellationToken)).toBeUndefined();
	});

	it('should dispose all handler registrations when disposed', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.start();
		server.dispose();

		const disposables = [
			...mockNotifications.on.mock.results,
			...mockDocuments.onDidClose.mock.results,
		];

		expect(disposables).toHaveLength(3);

		for (const disposable of disposables) {
			expect(disposable.value.dispose).toHaveBeenCalledTimes(1);
		}
	});

	it('should dispose the notification manager when disposed', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.dispose();

		expect(mockNotifications.dispose).toHaveBeenCalled();
	});

	it('should dispose the command manager when disposed', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.dispose();

		expect(mockCommands.dispose).toHaveBeenCalled();
	});

	it('should dispose the connection when disposed', async () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.start();

		const onInitializedHandler = mockNotifications.on.mock.calls.find(
			([type]) => type === InitializedNotification.type,
		)?.[1];

		await onInitializedHandler?.(
			{} as LSP.InitializedParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		server.dispose();

		expect(mockConnection.dispose).toHaveBeenCalled();
	});

	it('should not allow starting the server twice', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.start();

		expect(() => server.start()).toThrowErrorMatchingInlineSnapshot(
			`"Cannot transition from state Started to itself"`,
		);
	});

	it('should not allow starting the server once initialized', async () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.start();

		const onInitializedHandler = mockNotifications.on.mock.calls.find(
			([type]) => type === InitializedNotification.type,
		)?.[1];

		await onInitializedHandler?.(
			{} as LSP.InitializedParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		expect(() => server.start()).toThrowErrorMatchingInlineSnapshot(
			`"Can only transition state from Initialized to Disposed"`,
		);
	});

	it('should not allow starting the server once disposed', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.start();
		server.dispose();

		expect(() => server.start()).toThrowErrorMatchingInlineSnapshot(
			`"Cannot transition from Disposed"`,
		);
	});

	it('should not throw when calling dispose twice', () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.dispose();

		expect(() => server.dispose()).not.toThrow();
	});

	it('should dispose the server after receiving a shutdown request', async () => {
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			logger: mockLogger,
		});

		server.start();

		const onInitializedHandler = mockNotifications.on.mock.calls.find(
			([type]) => type === InitializedNotification.type,
		)?.[1];

		await onInitializedHandler?.(
			{} as LSP.InitializedParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const onShutdownHandler = mockConnection.onShutdown.mock.calls[0][0];

		await onShutdownHandler({} as LSP.CancellationToken);

		expect(mockLogger.info).toHaveBeenCalledWith('Stopping language server');
		expect(mockConnection.dispose).toHaveBeenCalledTimes(1);
		expect(mockNotifications.dispose).toHaveBeenCalledTimes(1);
		expect(mockCommands.dispose).toHaveBeenCalledTimes(1);
		expect(() => server.start()).toThrowErrorMatchingInlineSnapshot(
			`"Cannot transition from Disposed"`,
		);
	});

	test('should allow modules to get edit info for documents using context.getEditInfo', async () => {
		mockRunner.mockImplementation(() => ({}) as unknown as StylelintRunner);
		mockGetEditInfo.mockImplementation(
			() => ({ label: 'test' }) as unknown as ReturnType<typeof getEditInfo>,
		);

		const document = { uri: 'file:///test.css' } as TextDocument;
		const [TestModule, getContext] = getContextModule();
		const server = new StylelintLanguageServer({
			connection: mockConnection,
			modules: [TestModule],
		});

		server.start();

		const onInitializeHandler = mockConnection.onInitialize.mock.calls[0][0];

		await onInitializeHandler(
			{ capabilities: {} } as LSP.InitializeParams,
			{} as LSP.CancellationToken,
			{} as WorkDoneProgressReporter,
		);

		const editInfo = getContext()?.getEditInfo(document, {
			range: {
				start: { line: 1, character: 1 },
				end: { line: 1, character: 2 },
			},
			message: `Expected "#000" to be "#000000" (color-hex-length)`,
			source: 'stylelint',
			severity: LSP.DiagnosticSeverity.Error,
			code: 'color-hex-length',
		});

		expect(editInfo).toStrictEqual({ label: 'test' });
		expect(mockGetEditInfo.mock.calls).toMatchSnapshot();
	});
});
