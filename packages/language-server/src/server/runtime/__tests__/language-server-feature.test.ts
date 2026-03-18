import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Connection } from 'vscode-languageserver';
import type * as LSP from 'vscode-languageserver-protocol';
import {
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
} from 'vscode-languageserver-protocol';

import type { Container } from '../../../di/container.js';
import type { InjectionToken } from '../../../di/inject.js';
import type { RuntimeContext } from '../../../di/runtime/index.js';
import { CommandService } from '../../services/infrastructure/command.service.js';
import { NotificationService } from '../../services/infrastructure/notification.service.js';
import { StylelintRunnerService } from '../../services/stylelint-runtime/stylelint-runner.service.js';
import { WorkspaceOptionsService } from '../../services/workspace/workspace-options.service.js';
import { textDocumentsToken } from '../../tokens.js';
import { createLanguageServerFeature } from '../language-server-feature.js';
import { LanguageServerServiceRuntime } from '../lsp-service-runtime.js';

type LanguageServerServiceRuntimeStub = Pick<
	LanguageServerServiceRuntime,
	'runInitializers' | 'registerService' | 'registerCommandHandlers' | 'dispose'
>;

const languageServerConstructorFlag = '__isLanguageServerService__';
const serviceMetadataKey = '__languageServerServiceMetadata__';

interface ConnectionHandlers {
	initialize?: (params: LSP.InitializeParams) => LSP.InitializeResult;
	initialized?: (params: LSP.InitializedParams) => Promise<void> | void;
	didChangeConfiguration?: (params: LSP.DidChangeConfigurationParams) => void;
}

type MockConnection = Connection & {
	handlers: ConnectionHandlers;
	client: { register: ReturnType<typeof vi.fn> };
};

interface DocumentsStub {
	onDidClose: ReturnType<typeof vi.fn>;
	listen: ReturnType<typeof vi.fn>;
	handlers: {
		didClose?: (event: { document: { uri: string } }) => void;
	};
	disposable: { dispose: ReturnType<typeof vi.fn> };
}

interface RuntimeDependencyMap {
	documents: DocumentsStub;
	commandService: {
		register: ReturnType<typeof vi.fn>;
		on: ReturnType<typeof vi.fn>;
		dispose: ReturnType<typeof vi.fn>;
	};
	notificationService: { dispose: ReturnType<typeof vi.fn> };
	optionsService: {
		delete: ReturnType<typeof vi.fn>;
		setSupportsWorkspaceConfiguration: ReturnType<typeof vi.fn>;
		clearCache: ReturnType<typeof vi.fn>;
		updateGlobalOptions: ReturnType<typeof vi.fn>;
	};
	runnerService: { dispose: ReturnType<typeof vi.fn> };
	serviceInstance: { dispose: ReturnType<typeof vi.fn>; [serviceMetadataKey]?: unknown };
	container: Container & { resolve: ReturnType<typeof vi.fn> };
	connection: MockConnection;
}

function markAsLanguageServerService<T extends new (...args: unknown[]) => unknown>(ctor: T): T {
	Object.defineProperty(ctor, languageServerConstructorFlag, {
		value: true,
		writable: false,
		configurable: false,
		enumerable: false,
	});

	return ctor;
}

function createDocumentsStub(): DocumentsStub {
	const handlers: DocumentsStub['handlers'] = {};
	const disposable = { dispose: vi.fn() };

	return {
		onDidClose: vi.fn((handler: (event: { document: { uri: string } }) => void) => {
			handlers.didClose = handler;

			return disposable;
		}),
		listen: vi.fn(),
		handlers,
		disposable,
	};
}

function createCommandServiceStub() {
	return {
		register: vi.fn(),
		on: vi.fn(),
		dispose: vi.fn(),
	};
}

function createOptionsServiceStub() {
	return {
		delete: vi.fn(),
		setSupportsWorkspaceConfiguration: vi.fn(),
		clearCache: vi.fn(),
		updateGlobalOptions: vi.fn(),
	};
}

function createConnectionStub(): MockConnection {
	const handlers: ConnectionHandlers = {};
	const connection = {
		listen: vi.fn(),
		client: {
			register: vi.fn().mockResolvedValue(undefined),
		},
		onInitialize: vi.fn((handler: ConnectionHandlers['initialize']) => {
			handlers.initialize = handler;
		}),
		onInitialized: vi.fn((handler: ConnectionHandlers['initialized']) => {
			handlers.initialized = handler;
		}),
		onDidChangeConfiguration: vi.fn((handler: ConnectionHandlers['didChangeConfiguration']) => {
			handlers.didChangeConfiguration = handler;
		}),
		handlers,
	};

	return connection as unknown as MockConnection;
}

function createRuntimeDependencies(): RuntimeDependencyMap {
	const documents = createDocumentsStub();
	const commandService = createCommandServiceStub();
	const notificationService = { dispose: vi.fn() };
	const optionsService = createOptionsServiceStub();
	const runnerService = { dispose: vi.fn() };
	const serviceInstance = { dispose: vi.fn() };
	const connection = createConnectionStub();

	Object.defineProperty(serviceInstance, serviceMetadataKey, {
		value: {
			commandHandlers: [],
			initializerHandlers: [],
			textDocumentHandlers: [],
			notificationHandlers: [],
			shutdownHandlers: [],
			connectionHandlers: [],
			disposables: [],
		},
		writable: false,
		configurable: false,
		enumerable: false,
	});

	const ServiceCtor = markAsLanguageServerService(
		class TestLanguageServerService {
			public dispose = vi.fn();
		},
	);

	const resolutionMap = new Map<InjectionToken<unknown>, unknown>([
		[textDocumentsToken, documents],
		[CommandService, commandService],
		[NotificationService, notificationService],
		[WorkspaceOptionsService, optionsService],
		[StylelintRunnerService, runnerService],
		[ServiceCtor, serviceInstance],
	]);

	const resolve = vi.fn(<T>(token: InjectionToken<T>) => {
		if (!resolutionMap.has(token)) {
			throw new Error(`Unexpected token resolution: ${String(token)}`);
		}

		return resolutionMap.get(token) as T;
	});
	const container = { resolve } as Container & { resolve: ReturnType<typeof vi.fn> };

	return {
		documents,
		commandService,
		notificationService,
		optionsService,
		runnerService,
		serviceInstance,
		container,
		connection,
	};
}

function createRuntimeFactoryStub(overrides: Partial<LanguageServerServiceRuntimeStub> = {}) {
	const runtime: LanguageServerServiceRuntimeStub = {
		runInitializers: vi.fn(),
		registerService: vi.fn(),
		registerCommandHandlers: vi.fn(),
		dispose: vi.fn(),
		...overrides,
	};
	const factory = vi.fn(() => runtime as unknown as LanguageServerServiceRuntime);

	return { runtime, factory };
}

function createRuntimeContext(deps: RuntimeDependencyMap): RuntimeContext {
	const resolve = <T>(token: InjectionToken<T>): T => deps.container.resolve(token);

	return {
		container: deps.container,
		resolve,
		metadata: {
			services: [deps.serviceInstance],
		},
	};
}

beforeEach(() => {
	vi.restoreAllMocks();
});

describe('createLanguageServerFeature', () => {
	test('start wires services and registers handlers once', async () => {
		const runtimeDeps = createRuntimeDependencies();
		const { runtime, factory } = createRuntimeFactoryStub({
			runInitializers: vi.fn().mockReturnValue({ capabilities: { hoverProvider: true } }),
		});
		const feature = createLanguageServerFeature({
			connection: runtimeDeps.connection,
			runtimeFactory: factory,
		});
		const context = createRuntimeContext(runtimeDeps);

		await feature.start?.(context);
		await feature.start?.(context);

		expect(factory).toHaveBeenCalledTimes(1);
		expect(runtimeDeps.documents.listen).toHaveBeenCalledWith(runtimeDeps.connection);
		expect(runtimeDeps.commandService.register).toHaveBeenCalledTimes(1);
		expect(runtime.registerCommandHandlers).toHaveBeenCalledTimes(1);

		const initializeResult = runtimeDeps.connection.handlers.initialize?.({
			capabilities: {},
		} as LSP.InitializeParams);

		expect(initializeResult?.capabilities).toMatchObject({
			textDocumentSync: TextDocumentSyncKind.Full,
			hoverProvider: true,
		});
		expect(runtime.runInitializers).toHaveBeenCalledTimes(1);
		expect(runtimeDeps.optionsService.setSupportsWorkspaceConfiguration).toHaveBeenCalledWith(
			false,
		);
	});

	test('handles workspace configuration, notifications, and shutdown', async () => {
		const runtimeDeps = createRuntimeDependencies();
		const { runtime, factory } = createRuntimeFactoryStub();
		const feature = createLanguageServerFeature({
			connection: runtimeDeps.connection,
			runtimeFactory: factory,
		});
		const context = createRuntimeContext(runtimeDeps);

		await feature.start?.(context);

		runtimeDeps.connection.handlers.initialize?.({
			capabilities: { workspace: { configuration: true } },
		} as LSP.InitializeParams);

		await runtimeDeps.connection.handlers.initialized?.({} as LSP.InitializedParams);

		expect(runtimeDeps.connection.client.register).toHaveBeenCalledWith(
			DidChangeConfigurationNotification.type,
			{ section: 'stylelint' },
		);

		runtimeDeps.connection.handlers.didChangeConfiguration?.({
			settings: { foo: 'bar' },
		} as LSP.DidChangeConfigurationParams);

		expect(runtimeDeps.optionsService.clearCache).toHaveBeenCalledTimes(1);
		expect(runtimeDeps.optionsService.updateGlobalOptions).toHaveBeenCalledWith({ foo: 'bar' });

		runtimeDeps.documents.handlers.didClose?.({ document: { uri: 'file:///test.css' } });

		expect(runtimeDeps.optionsService.delete).toHaveBeenCalledWith('file:///test.css');

		await feature.shutdown?.(context);
		await feature.shutdown?.(context);
		feature.dispose?.();

		expect(runtime.dispose).toHaveBeenCalledTimes(1);
		expect(runtimeDeps.commandService.dispose).toHaveBeenCalledTimes(1);
		expect(runtimeDeps.notificationService.dispose).toHaveBeenCalledTimes(1);
		expect(runtimeDeps.runnerService.dispose).toHaveBeenCalledTimes(1);
		expect(runtimeDeps.documents.disposable.dispose).toHaveBeenCalledTimes(1);
	});
});
