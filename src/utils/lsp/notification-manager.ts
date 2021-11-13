import * as LSP from 'vscode-languageserver-protocol';
import { Connection } from 'vscode-languageserver';
import type winston from 'winston';

type Handlers = Map<
	| LSP.ProtocolNotificationType0<unknown>
	| LSP.ProtocolNotificationType<unknown, unknown>
	| LSP.NotificationType0
	| LSP.NotificationType<unknown>
	| string
	| undefined,
	LSP.GenericNotificationHandler[]
>;

/**
 * Allows registering multiple handlers for the same notification type.
 */
export class NotificationManager {
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
	constructor(connection: Connection, logger?: winston.Logger) {
		this.#connection = connection;
		this.#logger = logger;
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
		this.#logger?.debug('Received notification', { notificationType: key ?? '<all>', params });

		// This function is only ever called if the handler is registered.
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const handlers = this.#notifications.get(key)!;

		await Promise.all(
			handlers.map(async (handler) => {
				try {
					// Using await in case the handler is async
					await handler(...params);
				} catch (error) {
					this.#logger?.error('Error handling notification', {
						notificationType: key ?? '<all>',
						error,
					});
				}
			}),
		);
	}

	/**
	 * Registers a handler for a notification.
	 */
	on<R0>(type: LSP.ProtocolNotificationType0<R0>, handler: LSP.NotificationHandler0): void;
	on<P, R0>(type: LSP.ProtocolNotificationType<P, R0>, handler: LSP.NotificationHandler<P>): void;
	on(type: LSP.NotificationType0, handler: LSP.NotificationHandler0): void;
	on<P>(type: LSP.NotificationType<P>, handler: LSP.NotificationHandler<P>): void;
	on(type: string, handler: LSP.GenericNotificationHandler): void;
	on(handler: LSP.StarNotificationHandler): void;
	on<P, R0>(
		type:
			| LSP.ProtocolNotificationType0<R0>
			| LSP.ProtocolNotificationType<P, R0>
			| LSP.NotificationType0
			| LSP.NotificationType<P>
			| string
			| LSP.StarNotificationHandler,
		handler?: LSP.GenericNotificationHandler,
	): void {
		const isStar = typeof type === 'function';
		const [key, func] = isStar ? [undefined, type] : [type, handler];

		if (!func) {
			throw new Error('Handler must be defined');
		}

		const existing = this.#notifications.get(key);

		if (existing) {
			existing.push(func);

			return;
		}

		this.#notifications.set(key, [func]);

		if (isStar) {
			this.#connection.onNotification((...params) => this.#handleNotification(undefined, params));

			return;
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.#connection.onNotification<P, R0>(type as any, (...params) =>
			this.#handleNotification(type, params),
		);
	}
}
