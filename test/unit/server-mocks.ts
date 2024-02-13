// Part of test utils, don't record coverage
/* istanbul ignore file */
// cspell:ignore crit,emerg,unhandle,unregistration

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type LSP from 'vscode-languageserver-protocol';
import type {
	BulkRegistration,
	BulkUnregistration,
	Connection,
	TextDocuments,
} from 'vscode-languageserver';
import type winston from 'winston';
import type { LanguageServerContext, LanguageServerOptions } from '../../src/server/types';
import type { CommandManager, NotificationManager } from '../../src/utils/lsp';
import type { StylelintRunner } from '../../src/utils/stylelint';
import { MaybeAsync, PublicOnly, PublicOnlyDeep } from '../../src/utils/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JestFn = jest.Mock<any, any>;

export type MockConnection = jest.Mocked<PublicOnly<Connection>> & {
	__typed: () => Connection;
	client: jest.Mocked<PublicOnly<Connection['client']>> & {
		connection: MockConnection;
		register: jest.MockInstance<
			Promise<LSP.Disposable | BulkRegistration>,
			| [type: LSP.ProtocolNotificationType<unknown, unknown>, registerParams?: unknown]
			| [type: LSP.ProtocolNotificationType0<unknown>, registerParams?: unknown]
			| [
					unregistration: BulkUnregistration,
					type: LSP.ProtocolNotificationType<unknown, unknown>,
					registerParams?: unknown,
			  ]
			| [
					unregistration: BulkUnregistration,
					type: LSP.ProtocolNotificationType0<unknown>,
					registerParams?: unknown,
			  ]
			| [
					type: LSP.ProtocolRequestType<unknown, unknown, unknown, unknown, unknown>,
					registerParams?: unknown,
			  ]
			| [
					type: LSP.ProtocolRequestType0<unknown, unknown, unknown, unknown>,
					registerParams?: unknown,
			  ]
			| [
					unregistration: BulkUnregistration,
					type: LSP.ProtocolRequestType<unknown, unknown, unknown, unknown, unknown>,
					registerParams?: unknown,
			  ]
			| [
					unregistration: BulkUnregistration,
					type: LSP.ProtocolRequestType0<unknown, unknown, unknown, unknown>,
					registerParams?: unknown,
			  ]
			| [type: LSP.RegistrationType<unknown>, registerParams?: unknown]
			| [
					unregistration: BulkUnregistration,
					type: LSP.RegistrationType<unknown>,
					registerParams?: unknown,
			  ]
			| [registrations: BulkRegistration]
		>;
	};
	console: jest.Mocked<PublicOnly<Connection['console']>> & {
		connection: MockConnection;
	};
	languages: jest.Mocked<PublicOnly<Connection['languages']>> & {
		connection: MockConnection;
		callHierarchy: jest.Mocked<PublicOnly<Connection['languages']['callHierarchy']>>;
		moniker: jest.Mocked<PublicOnly<Connection['languages']['moniker']>>;
		semanticTokens: jest.Mocked<PublicOnly<Connection['languages']['semanticTokens']>>;
	};
	telemetry: jest.Mocked<PublicOnly<Connection['telemetry']>> & {
		connection: MockConnection;
	};
	tracer: jest.Mocked<PublicOnly<Connection['tracer']>> & {
		connection: MockConnection;
	};
	window: jest.Mocked<PublicOnly<Connection['window']>> & {
		connection: MockConnection;
	};
	workspace: jest.Mocked<PublicOnly<Connection['workspace']>> & {
		connection: MockConnection;
		getConfiguration: jest.MockInstance<
			Promise<unknown>,
			[section: string] | [item: LSP.ConfigurationItem] | [items: LSP.ConfigurationItem[]]
		>;
	};
};

/**
 * Returns a mock language server connection.
 */
export function getConnection(): MockConnection {
	const connection: MockConnection = {
		__typed: () => connection as Connection,
		client: {
			get connection() {
				return connection;
			},
			register: jest.fn(),
		},
		console: {
			get connection() {
				return connection;
			},
			error: jest.fn(),
			info: jest.fn(),
			log: jest.fn(),
			warn: jest.fn(),
		},
		dispose: jest.fn(),
		languages: {
			get connection() {
				return connection;
			},
			attachPartialResultProgress: jest.fn(),
			attachWorkDoneProgress: jest.fn(),
			callHierarchy: {
				onIncomingCalls: jest.fn(),
				onOutgoingCalls: jest.fn(),
				onPrepare: jest.fn(),
			},
			moniker: {
				on: jest.fn(),
			},
			onLinkedEditingRange: jest.fn(),
			semanticTokens: {
				on: jest.fn(),
				onDelta: jest.fn(),
				onRange: jest.fn(),
			},
		},
		listen: jest.fn(),
		onCodeAction: jest.fn(),
		onCodeActionResolve: jest.fn(),
		onCodeLens: jest.fn(),
		onCodeLensResolve: jest.fn(),
		onColorPresentation: jest.fn(),
		onCompletion: jest.fn(),
		onCompletionResolve: jest.fn(),
		onDeclaration: jest.fn(),
		onDefinition: jest.fn(),
		onDidChangeConfiguration: jest.fn(),
		onDidChangeTextDocument: jest.fn(),
		onDidChangeWatchedFiles: jest.fn(),
		onDidCloseTextDocument: jest.fn(),
		onDidOpenTextDocument: jest.fn(),
		onDidSaveTextDocument: jest.fn(),
		onDocumentColor: jest.fn(),
		onDocumentFormatting: jest.fn(),
		onDocumentHighlight: jest.fn(),
		onDocumentLinkResolve: jest.fn(),
		onDocumentLinks: jest.fn(),
		onDocumentOnTypeFormatting: jest.fn(),
		onDocumentRangeFormatting: jest.fn(),
		onDocumentSymbol: jest.fn(),
		onExecuteCommand: jest.fn(),
		onExit: jest.fn(),
		onFoldingRanges: jest.fn(),
		onHover: jest.fn(),
		onImplementation: jest.fn(),
		onInitialize: jest.fn(),
		onInitialized: jest.fn(),
		onNotification: jest.fn(),
		onPrepareRename: jest.fn(),
		onProgress: jest.fn(),
		onReferences: jest.fn(),
		onRenameRequest: jest.fn(),
		onRequest: jest.fn(),
		onSignatureHelp: jest.fn(),
		onSelectionRanges: jest.fn(),
		onShutdown: jest.fn(),
		onTypeDefinition: jest.fn(),
		onWillSaveTextDocument: jest.fn(),
		onWillSaveTextDocumentWaitUntil: jest.fn(),
		onWorkspaceSymbol: jest.fn(),
		sendDiagnostics: jest.fn(),
		sendNotification: jest.fn(),
		sendProgress: jest.fn(),
		sendRequest: jest.fn(),
		telemetry: {
			get connection() {
				return connection;
			},
			logEvent: jest.fn(),
		},
		tracer: {
			get connection() {
				return connection;
			},
			log: jest.fn(),
		},
		window: {
			get connection() {
				return connection;
			},
			attachWorkDoneProgress: jest.fn(),
			createWorkDoneProgress: jest.fn(),
			showDocument: jest.fn(),
			showErrorMessage: jest.fn(),
			showInformationMessage: jest.fn(),
			showWarningMessage: jest.fn(),
		},
		workspace: {
			get connection() {
				return connection;
			},
			applyEdit: jest.fn(),
			getConfiguration: jest.fn(),
			getWorkspaceFolders: jest.fn(),
			onDidChangeWorkspaceFolders: jest.fn(),
			onDidCreateFiles: jest.fn(),
			onDidDeleteFiles: jest.fn(),
			onDidRenameFiles: jest.fn(),
			onWillCreateFiles: jest.fn(),
			onWillDeleteFiles: jest.fn(),
			onWillRenameFiles: jest.fn(),
		},
	};

	return connection;
}

/**
 * Returns a mock logger.
 */
export function getLogger(): jest.Mocked<winston.Logger> {
	const logger: jest.Mocked<winston.Logger> = Object.assign(jest.fn(), {
		[Symbol.asyncIterator]: jest.fn(),
		_destroy: jest.fn(),
		_final: jest.fn(),
		_flush: jest.fn(),
		_read: jest.fn(),
		_transform: jest.fn(),
		_write: jest.fn(),
		add: jest.fn(),
		addListener: jest.fn(),
		alert: jest.fn(),
		allowHalfOpen: false,
		child: jest.fn(() => logger) as JestFn,
		close: jest.fn(),
		clear: jest.fn(),
		configure: jest.fn(),
		cork: jest.fn(),
		crit: jest.fn(),
		data: jest.fn(),
		debug: jest.fn(),
		destroy: jest.fn(),
		destroyed: false,
		emerg: jest.fn(),
		emit: jest.fn(),
		end: jest.fn(),
		error: jest.fn(),
		eventNames: jest.fn(),
		exceptions: Object.assign(jest.fn(), {
			catcher: false,
			getAllInfo: jest.fn(),
			getOsInfo: jest.fn(),
			getProcessInfo: jest.fn(),
			getTrace: jest.fn(),
			handle: jest.fn(),
			handlers: new Map(),
			logger: undefined as unknown as winston.Logger,
			unhandle: jest.fn(),
		}),
		exitOnError: false,
		format: {
			transform: jest.fn(),
			options: {},
		},
		getMaxListeners: jest.fn(),
		help: jest.fn(),
		http: jest.fn(),
		info: jest.fn(),
		input: jest.fn(),
		isDebugEnabled: jest.fn(() => true) as JestFn,
		isErrorEnabled: jest.fn(() => true) as JestFn,
		isInfoEnabled: jest.fn(() => true) as JestFn,
		isLevelEnabled: jest.fn(
			(level: string) =>
				level === 'info' || level === 'error' || level === 'debug' || level === 'warn',
		),
		isPaused: jest.fn(() => false) as JestFn,
		isWarnEnabled: jest.fn(() => true) as JestFn,
		isSillyEnabled: jest.fn(() => false) as JestFn,
		isVerboseEnabled: jest.fn(() => false) as JestFn,
		level: 'debug',
		levels: {
			silly: 0,
			debug: 1,
			verbose: 2,
			info: 3,
			warn: 4,
			error: 5,
			silent: 6,
		},
		listenerCount: jest.fn(),
		listeners: jest.fn(),
		log: jest.fn(),
		notice: jest.fn(),
		off: jest.fn(),
		on: jest.fn(),
		once: jest.fn(),
		pause: jest.fn(),
		pipe: jest.fn(),
		prependListener: jest.fn(),
		prependOnceListener: jest.fn(),
		profile: jest.fn(),
		profilers: {},
		prompt: jest.fn(),
		push: jest.fn(),
		query: jest.fn(),
		rawListeners: jest.fn(),
		read: jest.fn(),
		readable: true,
		readableAborted: false,
		readableDidRead: true,
		readableEncoding: 'utf8' as BufferEncoding,
		readableEnded: false,
		readableFlowing: true,
		readableHighWaterMark: 16,
		readableLength: 0,
		readableObjectMode: false,
		remove: jest.fn(),
		removeAllListeners: jest.fn(),
		removeListener: jest.fn(),
		rejections: Object.assign(jest.fn(), {
			catcher: false,
			getAllInfo: jest.fn(),
			getOsInfo: jest.fn(),
			getProcessInfo: jest.fn(),
			getTrace: jest.fn(),
			handle: jest.fn(),
			handlers: new Map(),
			logger: undefined as unknown as winston.Logger,
			unhandle: jest.fn(),
		}),
		resume: jest.fn(),
		setDefaultEncoding: jest.fn(),
		setEncoding: jest.fn(),
		setMaxListeners: jest.fn(),
		silent: false,
		silly: jest.fn(),
		startTimer: jest.fn(),
		stream: jest.fn(),
		transports: [],
		uncork: jest.fn(),
		unpipe: jest.fn(),
		unshift: jest.fn(),
		verbose: jest.fn(),
		warn: jest.fn(),
		warning: jest.fn(),
		wrap: jest.fn(),
		write: jest.fn(),
		writable: true,
		writableCorked: 0,
		writableEnded: false,
		writableFinished: false,
		writableHighWaterMark: 16,
		writableLength: 0,
		writableObjectMode: false,
	});

	Object.defineProperty(logger.exceptions, 'logger', {
		get: () => logger,
	});

	return logger;
}

export type MockTextDocuments = jest.Mocked<PublicOnly<TextDocuments<TextDocument>>> & {
	__typed: () => TextDocuments<TextDocument>;
};

/**
 * Returns a mock text document manager.
 */
export function getTextDocuments(): MockTextDocuments {
	const documents: MockTextDocuments = {
		__typed: () => documents as unknown as TextDocuments<TextDocument>,
		all: jest.fn(),
		get: jest.fn(),
		keys: jest.fn(),
		listen: jest.fn(),
		onDidChangeContent: jest.fn(() => ({ dispose: jest.fn() })) as JestFn,
		onDidClose: jest.fn(() => ({ dispose: jest.fn() })) as JestFn,
		onDidOpen: jest.fn(() => ({ dispose: jest.fn() })) as JestFn,
		onDidSave: jest.fn(() => ({ dispose: jest.fn() })) as JestFn,
		onWillSave: jest.fn(() => ({ dispose: jest.fn() })) as JestFn,
		onWillSaveWaitUntil: jest.fn(() => ({ dispose: jest.fn() })) as JestFn,
	};

	return documents;
}

export type MockCommandManager = jest.Mocked<PublicOnly<CommandManager>> & {
	__typed: () => CommandManager;
};

/**
 * Returns a mock command manager.
 */
export function getCommandManager(): MockCommandManager {
	const manager: MockCommandManager = {
		__typed: () => manager as unknown as CommandManager,
		dispose: jest.fn(),
		on: jest.fn(() => ({ dispose: jest.fn() })) as JestFn,
		register: jest.fn(),
	};

	return manager;
}

export type MockNotificationManager = Omit<jest.Mocked<PublicOnly<NotificationManager>>, 'on'> &
	Pick<NotificationManager, 'on'> & {
		__typed: () => NotificationManager;
		on: jest.MockInstance<
			LSP.Disposable,
			| [handler: MaybeAsync<LSP.StarNotificationHandler>]
			| [
					(
						| LSP.ProtocolNotificationType0<unknown>
						| LSP.ProtocolNotificationType<unknown, unknown>
						| LSP.NotificationType0
						| LSP.NotificationType<unknown>
						| string
					),
					MaybeAsync<LSP.GenericNotificationHandler>,
			  ]
		>;
	};

/**
 * Returns a mock notification manager.
 */
export function getNotificationManager(): MockNotificationManager {
	const manager: MockNotificationManager = {
		__typed: () => manager as unknown as NotificationManager,
		dispose: jest.fn(),
		on: jest.fn(() => ({ dispose: jest.fn() })) as JestFn,
	};

	return manager;
}

export type MockStylelintRunner = jest.Mocked<PublicOnly<StylelintRunner>> & {
	__typed: () => StylelintRunner;
};

/**
 * Returns a mock Stylelint runner.
 */
export function getStylelintRunner(): MockStylelintRunner {
	const runner: MockStylelintRunner = {
		__typed: () => runner as unknown as StylelintRunner,
		lintDocument: jest.fn(),
	};

	return runner;
}

/**
 * Returns mock language server options.
 */
export function getOptions(): LanguageServerOptions {
	return {
		codeAction: {
			disableRuleComment: {
				location: 'separateLine',
			},
		},
		config: null,
		configFile: '',
		configBasedir: '',
		customSyntax: '',
		ignoreDisables: false,
		packageManager: 'npm',
		reportDescriptionlessDisables: false,
		reportInvalidScopeDisables: false,
		reportNeedlessDisables: false,
		snippet: ['css', 'postcss'],
		stylelintPath: '',
		validate: ['css', 'postcss'],
	};
}

export type MockLanguageServerContext = jest.Mocked<PublicOnlyDeep<LanguageServerContext>> & {
	__typed: () => LanguageServerContext;
	__options: LanguageServerOptions;
	connection: MockConnection;
	documents: MockTextDocuments;
	commands: MockCommandManager;
	notifications: MockNotificationManager;
	runner: MockStylelintRunner;
};

/**
 * Returns a mock language server context.
 */
export function getContext(): MockLanguageServerContext {
	const context: MockLanguageServerContext = {
		__typed: () => context as unknown as LanguageServerContext,
		__options: getOptions(),
		connection: getConnection(),
		documents: getTextDocuments(),
		commands: getCommandManager(),
		notifications: getNotificationManager(),
		runner: getStylelintRunner(),
		displayError: jest.fn(),
		getOptions: jest.fn(async () => context.__options) as JestFn,
		getFixes: jest.fn(),
		getModule: jest.fn(),
		lintDocument: jest.fn(),
		resolveStylelint: jest.fn(),
	};

	return context;
}
