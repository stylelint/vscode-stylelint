// Part of test utils, don't record coverage
/* istanbul ignore file */
// cspell:ignore crit,emerg,unhandle

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Connection, TextDocuments } from 'vscode-languageserver';
import type winston from 'winston';
import type { LanguageServerContext, LanguageServerOptions } from '../../src/server/types';
import type { CommandManager, NotificationManager } from '../../src/utils/lsp';
import type { StylelintRunner } from '../../src/utils/stylelint';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JestFn = jest.Mock<any, any>;

export type MockConnection = {
	__typed: () => Connection;
	client: {
		connection: MockConnection;
		register: JestFn;
	};
	console: {
		connection: MockConnection;
		error: JestFn;
		info: JestFn;
		log: JestFn;
		warn: JestFn;
	};
	dispose: JestFn;
	languages: {
		connection: MockConnection;
		attachPartialResultProgress: JestFn;
		attachWorkDoneProgress: JestFn;
		callHierarchy: {
			onIncomingCalls: JestFn;
			onOutgoingCalls: JestFn;
			onPrepare: JestFn;
		};
		moniker: {
			on: JestFn;
		};
		onLinkedEditingRange: JestFn;
		semanticTokens: {
			on: JestFn;
			onDelta: JestFn;
			onRange: JestFn;
		};
	};
	listen: JestFn;
	onCodeAction: JestFn;
	onCodeActionResolve: JestFn;
	onCodeLens: JestFn;
	onCodeLensResolve: JestFn;
	onColorPresentation: JestFn;
	onCompletion: JestFn;
	onCompletionResolve: JestFn;
	onDeclaration: JestFn;
	onDefinition: JestFn;
	onDidChangeConfiguration: JestFn;
	onDidChangeTextDocument: JestFn;
	onDidChangeWatchedFiles: JestFn;
	onDidCloseTextDocument: JestFn;
	onDidOpenTextDocument: JestFn;
	onDidSaveTextDocument: JestFn;
	onDocumentColor: JestFn;
	onDocumentFormatting: JestFn;
	onDocumentHighlight: JestFn;
	onDocumentLinkResolve: JestFn;
	onDocumentLinks: JestFn;
	onDocumentOnTypeFormatting: JestFn;
	onDocumentRangeFormatting: JestFn;
	onDocumentSymbol: JestFn;
	onExecuteCommand: JestFn;
	onExit: JestFn;
	onFoldingRanges: JestFn;
	onHover: JestFn;
	onImplementation: JestFn;
	onInitialize: JestFn;
	onInitialized: JestFn;
	onNotification: JestFn;
	onPrepareRename: JestFn;
	onProgress: JestFn;
	onReferences: JestFn;
	onRenameRequest: JestFn;
	onRequest: JestFn;
	onSignatureHelp: JestFn;
	onSelectionRanges: JestFn;
	onShutdown: JestFn;
	onTypeDefinition: JestFn;
	onWillSaveTextDocument: JestFn;
	onWillSaveTextDocumentWaitUntil: JestFn;
	onWorkspaceSymbol: JestFn;
	sendDiagnostics: JestFn;
	sendNotification: JestFn;
	sendProgress: JestFn;
	sendRequest: JestFn;
	telemetry: {
		connection: MockConnection;
		logEvent: JestFn;
	};
	tracer: {
		connection: MockConnection;
		log: JestFn;
	};
	window: {
		connection: MockConnection;
		attachWorkDoneProgress: JestFn;
		createWorkDoneProgress: JestFn;
		showDocument: JestFn;
		showErrorMessage: JestFn;
		showInformationMessage: JestFn;
		showWarningMessage: JestFn;
	};
	workspace: {
		connection: MockConnection;
		applyEdit: JestFn;
		getConfiguration: JestFn;
		getWorkspaceFolders: JestFn;
		onDidChangeWorkspaceFolders: JestFn;
		onDidCreateFiles: JestFn;
		onDidDeleteFiles: JestFn;
		onDidRenameFiles: JestFn;
		onWillCreateFiles: JestFn;
		onWillDeleteFiles: JestFn;
		onWillRenameFiles: JestFn;
	};
};

/**
 * Returns a mock language server connection.
 */
export function getConnection(): MockConnection {
	const connection: MockConnection = {
		__typed: () => connection as unknown as Connection,
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
		sendDiagnostics: jest.fn(() => Promise.resolve()),
		sendNotification: jest.fn(() => Promise.resolve()),
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
		child: jest.fn().mockImplementation(() => logger),
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
		isDebugEnabled: jest.fn().mockReturnValue(true),
		isErrorEnabled: jest.fn().mockReturnValue(true),
		isInfoEnabled: jest.fn().mockReturnValue(true),
		isLevelEnabled: jest
			.fn()
			.mockImplementation(
				(level: string) =>
					level === 'info' || level === 'error' || level === 'debug' || level === 'warn',
			),
		isPaused: jest.fn().mockReturnValue(false),
		isWarnEnabled: jest.fn().mockReturnValue(true),
		isSillyEnabled: jest.fn().mockReturnValue(false),
		isVerboseEnabled: jest.fn().mockReturnValue(false),
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
	}) as unknown as jest.Mocked<winston.Logger>;

	Object.defineProperty(logger.exceptions, 'logger', {
		get: () => logger,
	});

	return logger;
}

export type MockTextDocuments = {
	__typed: () => TextDocuments<TextDocument>;
	all: JestFn;
	get: JestFn;
	keys: JestFn;
	listen: JestFn;
	onDidChangeContent: JestFn;
	onDidClose: JestFn;
	onDidOpen: JestFn;
	onDidSave: JestFn;
	onWillSave: JestFn;
	onWillSaveWaitUntil: JestFn;
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
		onDidChangeContent: jest.fn(),
		onDidClose: jest.fn(),
		onDidOpen: jest.fn(),
		onDidSave: jest.fn(),
		onWillSave: jest.fn(),
		onWillSaveWaitUntil: jest.fn(),
	};

	return documents;
}

export type MockCommandManager = {
	__typed: () => CommandManager;
	on: JestFn;
	register: JestFn;
};

/**
 * Returns a mock command manager.
 */
export function getCommandManager(): MockCommandManager {
	const manager: MockCommandManager = {
		__typed: () => manager as unknown as CommandManager,
		on: jest.fn(),
		register: jest.fn(),
	};

	return manager;
}

export type MockNotificationManager = {
	__typed: () => NotificationManager;
	on: JestFn;
};

/**
 * Returns a mock notification manager.
 */
export function getNotificationManager(): MockNotificationManager {
	const manager: MockNotificationManager = {
		__typed: () => manager as unknown as NotificationManager,
		on: jest.fn(),
	};

	return manager;
}

export type MockStylelintRunner = {
	__typed: () => StylelintRunner;
	lintDocument: JestFn;
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
		reportInvalidScopeDisables: false,
		reportNeedlessDisables: false,
		snippet: ['css', 'postcss'],
		stylelintPath: '',
		validate: ['css', 'postcss'],
	};
}

export type MockLanguageServerContext = {
	__typed: () => LanguageServerContext;
	__options: LanguageServerOptions;
	connection: MockConnection;
	documents: MockTextDocuments;
	commands: MockCommandManager;
	notifications: MockNotificationManager;
	runner: MockStylelintRunner;
	displayError: JestFn;
	getOptions: jest.MockedFunction<() => Promise<LanguageServerOptions>>;
	getFixes: JestFn;
	getModule: JestFn;
	lintDocument: JestFn;
	resolveStylelint: JestFn;
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
		getOptions: jest.fn(async () => context.__options),
		getFixes: jest.fn(),
		getModule: jest.fn(),
		lintDocument: jest.fn(),
		resolveStylelint: jest.fn(),
	};

	return context;
}
