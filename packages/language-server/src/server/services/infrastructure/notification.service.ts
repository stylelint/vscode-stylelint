import { Connection, Disposable } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import type winston from 'winston';
import { inject } from '../../../di/index.js';
import { MaybeAsync } from '../../utils/index.js';
import { lspConnectionToken } from '../../tokens.js';
import { type LoggingService, loggingServiceToken } from './logging.service.js';

type Handlers = Map<
	| LSP.ProtocolNotificationType0<unknown>
	| LSP.ProtocolNotificationType<unknown, unknown>
	| LSP.NotificationType0
	| LSP.NotificationType<unknown>
	| string
	| undefined,
	Set<MaybeAsync<LSP.GenericNotificationHandler>>
>;

/**
 * Allows registering multiple handlers for the same notification type.
 */
@inject({
	inject: [lspConnectionToken, loggingServiceToken],
})
export class NotificationService implements Disposable {
	/**
	 * The connection to the server.
	 */
	#connection: Connection;

	/**
	 * The logger to use.
	 */
	#logger?: winston.Logger;

	/**
	 * The registered notification handlers.
	 */
	#notifications: Handlers = new Map();

	/**
	 * Instantiates a new notification manager.
	 */
	constructor(connection: Connection, loggingService: LoggingService) {
		this.#connection = connection;
		this.#logger = loggingService.createLogger(NotificationService);
	}

	dispose(): void {
		this.#logger?.debug('Disposing notification manager');

		for (const [type] of this.#notifications) {
			if (type) {
				this.#connection.onNotification(
					type as LSP.ProtocolNotificationType<unknown, unknown>,
					() => undefined,
				);
			} else {
				this.#connection.onNotification(() => undefined);
			}
		}

		this.#notifications.clear();
	}

	async #handleNotification<P, R0>(
		key:
			| LSP.ProtocolNotificationType0<R0>
			| LSP.ProtocolNotificationType<P, R0>
			| LSP.NotificationType0
			| LSP.NotificationType<P>
			| string
			| undefined,
		params: Parameters<
			| LSP.NotificationHandler<P>
			| LSP.NotificationHandler0
			| LSP.GenericNotificationHandler
			| LSP.StarNotificationHandler
		>,
	): Promise<void> {
		this.#logger?.debug('Received notification', {
			notificationType: key ?? '<all>',
			params,
		});

		// This function is only ever called if the handler is registered.
		const handlers = this.#notifications.get(key)!;

		const funcs: (() => Promise<void>)[] = [];

		for (const handler of handlers) {
			funcs.push(async () => {
				try {
					await handler(...params);
				} catch (error) {
					this.#logger?.error('Error handling notification', {
						notificationType: key ?? '<all>',
						error,
					});
				}
			});
		}

		await Promise.all(funcs.map((func) => func()));
	}

	/**
	 * Registers a handler for a notification.
	 */
	on<R0>(
		type: LSP.ProtocolNotificationType0<R0>,
		handler: MaybeAsync<LSP.NotificationHandler0>,
	): Disposable;
	on<P, R0>(
		type: LSP.ProtocolNotificationType<P, R0>,
		handler: MaybeAsync<LSP.NotificationHandler<P>>,
	): Disposable;
	on(type: LSP.NotificationType0, handler: MaybeAsync<LSP.NotificationHandler0>): Disposable;
	on<P>(type: LSP.NotificationType<P>, handler: MaybeAsync<LSP.NotificationHandler<P>>): Disposable;
	on(type: string, handler: MaybeAsync<LSP.GenericNotificationHandler>): Disposable;
	on(handler: LSP.StarNotificationHandler): Disposable;
	on<P, R0>(
		type:
			| LSP.ProtocolNotificationType0<R0>
			| LSP.ProtocolNotificationType<P, R0>
			| LSP.NotificationType0
			| LSP.NotificationType<P>
			| string
			| MaybeAsync<LSP.StarNotificationHandler>,
		handler?: MaybeAsync<LSP.GenericNotificationHandler>,
	): Disposable {
		const isStar = typeof type === 'function';
		const [key, func] = isStar ? [undefined, type] : [type, handler];

		if (!func) {
			throw new Error('Handler must be defined');
		}

		const disposable = {
			dispose: () => {
				this.#notifications.get(key)?.delete(func);
			},
		};

		const existing = this.#notifications.get(key);

		if (existing) {
			existing.add(func);

			return disposable;
		}

		this.#notifications.set(key, new Set([func]));

		if (isStar) {
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			this.#connection.onNotification((...params) => this.#handleNotification(undefined, params));

			return disposable;
		}

		this.#connection.onNotification<P, R0>(
			type as LSP.ProtocolNotificationType<P, R0>,
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			(...params) => this.#handleNotification(type, params),
		);

		return disposable;
	}
}
