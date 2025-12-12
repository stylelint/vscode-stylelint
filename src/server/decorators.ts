// Function type is used to match decorator signatures. Non-arrow functions are
// needed for correct `this` binding. The `any` type is used since otherwise
// there will be conflicts with method and constructor signatures. And the
// functions are bound not by the decorator but by the initializer, so it's
// safe to disable the relevant eslint rules here.
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable func-names */
/* eslint-disable @typescript-eslint/unbound-method */

import type { Connection, HandlerResult } from 'vscode-languageserver';
import type LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocumentChangeEvent } from 'vscode-languageserver/node';
import {
	Constructable,
	registerInitializationHook,
	runtimeService,
	type InjectionToken,
} from '../di/index.js';
import {
	ClassDecoratorFunction,
	CompatibleMethodDecorator,
	MethodDecoratorFunction,
} from '../di/types.js';
import { NotificationService } from './services/infrastructure/notification.service.js';
import { lspConnectionToken } from './tokens.js';
import { CommandId } from './types.js';
import { MaybeAsync } from './utils/index.js';

const lspServiceMetadataKey = '__languageServerServiceMetadata__';
const lspServiceConstructorMetadataKey = '__isLanguageServerService__';

export interface CommandHandlerMetadata {
	commandId: CommandId;
	methodName: string | symbol;
	handler: CommandMethod;
	options: CommandOptions;
}

export type InitializeHandler = (
	params?: LSP.InitializeParams,
) => Partial<LSP.InitializeResult> | void;

export interface LspServiceInstanceMetadata {
	commandHandlers: CommandHandlerMetadata[];
	initializerHandlers: InitializeHandler[];
	textDocumentHandlers: TextDocumentHandlerMetadata[];
	notificationHandlers: NotificationHandlerMetadata[];
	shutdownHandlers: ShutdownHandler[];
	connectionHandlers: ConnectionHandlerMetadata[];
	disposables: LSP.Disposable[];
}

export type TextDocumentEventName = 'onDidOpen' | 'onDidChangeContent' | 'onDidSave' | 'onDidClose';

export type TextDocumentEventHandler = (
	event: TextDocumentChangeEvent<TextDocument>,
) => Promise<void> | void;

export interface TextDocumentHandlerMetadata {
	event: TextDocumentEventName;
	handler: TextDocumentEventHandler;
}

export type NotificationRegistrationType =
	| LSP.ProtocolNotificationType0<unknown>
	| LSP.ProtocolNotificationType<unknown, unknown>
	| LSP.NotificationType0
	| LSP.NotificationType<unknown>
	| string
	| undefined;

export type NotificationMethod = (...args: unknown[]) => Promise<void> | void;

export interface NotificationHandlerMetadata {
	type: NotificationRegistrationType;
	handler: NotificationMethod;
}

interface ConnectionHandlerMap {
	completion: CompletionRequestHandler;
	codeAction: CodeActionRequestHandler;
	documentFormatting: DocumentFormattingRequestHandler;
}

type ConnectionHandlerKind = keyof ConnectionHandlerMap;

export type ConnectionHandlerMetadata = {
	[K in ConnectionHandlerKind]: { kind: K; handler: ConnectionHandlerMap[K] };
}[ConnectionHandlerKind];

type CompletionRequestHandler = (
	params: LSP.CompletionParams,
) => Promise<LSP.CompletionItem[] | LSP.CompletionList | undefined | null>;

type CodeActionRequestHandler = (
	params: LSP.CodeActionParams,
) => Promise<(LSP.Command | LSP.CodeAction)[] | undefined | null>;

type DocumentFormattingRequestHandler = (
	params: LSP.DocumentFormattingParams,
) => Promise<LSP.TextEdit[] | undefined | null>;

type AsyncNotificationHandler0 = MaybeAsync<() => void>;
type AsyncNotificationHandler<P> = MaybeAsync<(params: P) => void>;
type AsyncGenericNotificationHandler = MaybeAsync<LSP.GenericNotificationHandler>;
type AsyncStarNotificationHandler = MaybeAsync<LSP.StarNotificationHandler>;

export type ShutdownHandler = () => void | Promise<void>;

export type DecoratedLspServiceConstructor = Constructable<object> & {
	[lspServiceConstructorMetadataKey]: true;
};

/**
 * Returns if the given instance is of a class decorated as a language server service.
 */
export function isLanguageServerServiceInstance(
	instance: unknown,
): instance is { [lspServiceMetadataKey]: LspServiceInstanceMetadata } {
	return typeof instance === 'object' && instance !== null && lspServiceMetadataKey in instance;
}

/**
 * Returns if the given class is decorated as a language server service.
 */
export function isLanguageServerServiceConstructor(
	target: Constructable<unknown>,
): target is Constructable<unknown> & {
	__isLanguageServerService__: true;
} {
	return (
		lspServiceConstructorMetadataKey in target &&
		(target as { [lspServiceConstructorMetadataKey]: unknown })[
			lspServiceConstructorMetadataKey
		] === true
	);
}

/**
 * Ensures that the given instance has language server service metadata.
 */
function ensureLanguageServerServiceMetadata(instance: unknown): LspServiceInstanceMetadata {
	if (typeof instance !== 'object' || instance === null) {
		throw new Error('Language server services must be class instances.');
	}

	const ctor = (instance as { constructor?: unknown }).constructor;

	if (!isLanguageServerServiceConstructor(ctor as Constructable<unknown>)) {
		throw new Error(
			'@lspService() must decorate a class before using language server service decorators.',
		);
	}

	if (isLanguageServerServiceInstance(instance)) {
		return (instance as { [lspServiceMetadataKey]: LspServiceInstanceMetadata })[
			lspServiceMetadataKey
		];
	}

	const metadata: LspServiceInstanceMetadata = {
		commandHandlers: [],
		disposables: [],
		connectionHandlers: [],
		initializerHandlers: [],
		notificationHandlers: [],
		textDocumentHandlers: [],
		shutdownHandlers: [],
	};

	Object.defineProperty(instance, lspServiceMetadataKey, {
		value: metadata,
		writable: false,
		configurable: false,
		enumerable: false,
	});

	return metadata;
}

/**
 * Gets the language server service metadata for the given instance.
 */
export function getLanguageServerServiceMetadata(
	instance: unknown,
): LspServiceInstanceMetadata | undefined {
	if (!isLanguageServerServiceInstance(instance)) {
		return undefined;
	}

	return (instance as { [lspServiceMetadataKey]: LspServiceInstanceMetadata })[
		lspServiceMetadataKey
	];
}

/**
 * Registers a notification handler for the given metadata.
 */
function registerNotificationHandler(
	manager: NotificationService,
	descriptor: NotificationHandlerMetadata,
): LSP.Disposable {
	const notificationType = descriptor.type;

	if (typeof notificationType === 'undefined') {
		return manager.on(descriptor.handler as LSP.StarNotificationHandler);
	}

	return manager.on(notificationType as never, descriptor.handler as never);
}

type ResolveFunction = <T>(token: InjectionToken<T>) => T;

/**
 * Registers notification handlers for the given metadata.
 */
function registerNotificationHandlers(
	metadata: LspServiceInstanceMetadata,
	resolve: ResolveFunction,
): void {
	if (metadata.notificationHandlers.length === 0) {
		return;
	}

	const manager = resolve(NotificationService);

	for (const descriptor of metadata.notificationHandlers) {
		const disposable = registerNotificationHandler(manager, descriptor);

		metadata.disposables.push(disposable);
	}
}

/**
 * Registers a connection handler for the given metadata.
 */
function registerConnectionHandler(
	connection: Connection,
	descriptor: ConnectionHandlerMetadata,
): LSP.Disposable {
	switch (descriptor.kind) {
		case 'completion':
			return connection.onCompletion((params, _token, _workDone, _resultProgress) =>
				descriptor.handler(params),
			);
		case 'codeAction':
			return connection.onCodeAction((params, _token, _workDone, _resultProgress) =>
				descriptor.handler(params),
			);
		case 'documentFormatting':
			return connection.onDocumentFormatting((params, _token, _workDone, _resultProgress) =>
				descriptor.handler(params),
			);
		default: {
			const neverDescriptor: never = descriptor;

			throw new Error(`Unsupported connection handler kind: ${String(neverDescriptor)}`);
		}
	}
}

/**
 * Registers connection handlers for the given metadata.
 */
function registerConnectionHandlers(
	metadata: LspServiceInstanceMetadata,
	resolve: ResolveFunction,
): void {
	if (metadata.connectionHandlers.length === 0) {
		return;
	}

	const connection = resolve(lspConnectionToken);

	for (const descriptor of metadata.connectionHandlers) {
		const disposable = registerConnectionHandler(connection, descriptor);

		metadata.disposables.push(disposable);
	}
}

/**
 * Decorates a class as being a service that participates in the language server
 * lifecycle.
 */
export function lspService(): ClassDecoratorFunction {
	const runtimeServiceDecorator = runtimeService();

	return (target: Function, context: ClassDecoratorContext) => {
		const { kind } = context;

		if (kind !== 'class') {
			throw new Error('@lspService() can only be used on a class.');
		}

		const ctor = target as Constructable<unknown>;

		runtimeServiceDecorator(target as new (...args: any[]) => object, context);

		Object.defineProperty(ctor, lspServiceConstructorMetadataKey, {
			value: true,
			writable: false,
			configurable: false,
			enumerable: false,
		});

		registerInitializationHook(ctor, ({ instance, resolve }) => {
			const metadata = ensureLanguageServerServiceMetadata(instance);

			registerNotificationHandlers(metadata, resolve);
			registerConnectionHandlers(metadata, resolve);
		});
	};
}

export interface CommandOptions {
	minArgs?: number;
}

export type CommandMethod = <R>(...args: any[]) => HandlerResult<any, R>;

/**
 * Decorator to mark a method as a handler for a specific command ID.
 * @param commandId The command ID to handle.
 */
export function command(
	commandId: CommandId,
	options: CommandOptions = {},
): MethodDecoratorFunction<CommandMethod> {
	return (target: Function, { kind, name, addInitializer }: ClassMethodDecoratorContext) => {
		if (kind !== 'method') {
			throw new Error('@command(...) can only be used on a method.');
		}

		addInitializer(function () {
			const instanceMetadata = ensureLanguageServerServiceMetadata(this);
			const bound = target.bind(this) as CommandMethod;

			instanceMetadata.commandHandlers.push({
				commandId,
				methodName: name ?? target.name,
				handler: bound,
				options,
			});
		});
	};
}

/**
 * Decorator to mark a method as an initialization handler.
 */
export function initialize(): MethodDecoratorFunction<InitializeHandler> {
	// Function type used to match decorator signature.

	return (target: Function, { kind, addInitializer }: ClassMethodDecoratorContext) => {
		if (kind !== 'method') {
			throw new Error('@initialize() can only be used on a method.');
		}

		addInitializer(function () {
			const instanceMetadata = ensureLanguageServerServiceMetadata(this);
			const bound = target.bind(this) as InitializeHandler;

			instanceMetadata.initializerHandlers.push(bound);
		});
	};
}

/**
 *
 */
export function textDocumentEvent(
	event: TextDocumentEventName,
): CompatibleMethodDecorator<TextDocumentEventHandler> {
	return (target: Function, { kind, addInitializer }: ClassMethodDecoratorContext) => {
		if (kind !== 'method') {
			throw new Error('@textDocumentEvent(...) can only be used on a method.');
		}

		addInitializer(function () {
			const instanceMetadata = ensureLanguageServerServiceMetadata(this);
			const bound = target.bind(this) as TextDocumentEventHandler;

			instanceMetadata.textDocumentHandlers.push({
				event,
				handler: bound,
			});
		});
	};
}

export function notification<R0>(
	type: LSP.ProtocolNotificationType0<R0>,
): CompatibleMethodDecorator<AsyncNotificationHandler0>;
export function notification<P, R0>(
	type: LSP.ProtocolNotificationType<P, R0>,
): CompatibleMethodDecorator<AsyncNotificationHandler<P>>;
export function notification(
	type: LSP.NotificationType0,
): CompatibleMethodDecorator<AsyncNotificationHandler0>;
export function notification<P>(
	type: LSP.NotificationType<P>,
): CompatibleMethodDecorator<AsyncNotificationHandler<P>>;
export function notification(
	type: string,
): CompatibleMethodDecorator<AsyncGenericNotificationHandler>;
export function notification(): CompatibleMethodDecorator<AsyncStarNotificationHandler>;
/**
 *
 */
export function notification(type?: NotificationRegistrationType): MethodDecoratorFunction<any> {
	return (target: Function, { kind, addInitializer }: ClassMethodDecoratorContext) => {
		if (kind !== 'method') {
			throw new Error('@notification(...) can only be used on a method.');
		}

		addInitializer(function () {
			const instanceMetadata = ensureLanguageServerServiceMetadata(this);
			const bound = target.bind(this) as NotificationMethod;

			instanceMetadata.notificationHandlers.push({
				type,
				handler: bound,
			});
		});
	};
}

/**
 * Creates a connection handler decorator for a specific kind of connection.
 */
function createConnectionHandlerDecorator<K extends ConnectionHandlerKind>(
	kind: K,
	decoratorName: string,
): MethodDecoratorFunction<ConnectionHandlerMap[K]> {
	return (
		target: Function,
		{ kind: decoratorKind, addInitializer }: ClassMethodDecoratorContext,
	) => {
		if (decoratorKind !== 'method') {
			throw new Error(`${decoratorName} can only be used on a method.`);
		}

		addInitializer(function () {
			const instanceMetadata = ensureLanguageServerServiceMetadata(this);
			const bound = target.bind(this) as ConnectionHandlerMap[K];
			const descriptor = {
				kind,
				handler: bound,
			} as ConnectionHandlerMetadata;

			instanceMetadata.connectionHandlers.push(descriptor);
		});
	};
}

/**
 * Marks a method as a handler for a specific completion request.
 */
export function completionRequest(): MethodDecoratorFunction<CompletionRequestHandler> {
	return createConnectionHandlerDecorator('completion', '@completionRequest()');
}

/**
 * Marks a method as a handler for a specific code action request.
 */
export function codeActionRequest(): MethodDecoratorFunction<CodeActionRequestHandler> {
	return createConnectionHandlerDecorator('codeAction', '@codeActionRequest()');
}

/**
 * Marks a method as a handler for a specific document formatting request.
 */
export function documentFormattingRequest(): MethodDecoratorFunction<DocumentFormattingRequestHandler> {
	return createConnectionHandlerDecorator('documentFormatting', '@documentFormattingRequest()');
}

/**
 * Marks a method as a shutdown handler.
 */
export function shutdown(): MethodDecoratorFunction<ShutdownHandler> {
	return (target: Function, { kind, addInitializer }: ClassMethodDecoratorContext) => {
		if (kind !== 'method') {
			throw new Error('@shutdown() can only be used on a method.');
		}

		addInitializer(function () {
			const instanceMetadata = ensureLanguageServerServiceMetadata(this);
			const bound = target.bind(this) as ShutdownHandler;

			instanceMetadata.shutdownHandlers.push(bound);
		});
	};
}
