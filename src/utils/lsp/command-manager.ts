import * as LSP from 'vscode-languageserver-protocol';
import type { Connection, Disposable, ServerRequestHandler } from 'vscode-languageserver';
import type winston from 'winston';

/**
 * Allows registering and executing commands and their handlers by name.
 */
export class CommandManager implements Disposable {
	/**
	 * The language server connection.
	 */
	#connection: Connection;

	/**
	 * The logger to use.
	 */
	#logger?: winston.Logger;

	/**
	 * Command handlers by command name.
	 */
	#commands = new Map<
		string,
		ServerRequestHandler<LSP.ExecuteCommandParams, unknown, never, void>
	>();

	/**
	 * Instantiates a new command manager.
	 */
	constructor(connection: Connection, logger?: winston.Logger) {
		this.#connection = connection;
		this.#logger = logger;
	}

	dispose(): void {
		this.#logger?.debug('Disposing command manager');

		this.#commands.clear();
		this.#connection.onExecuteCommand(() => undefined);
	}

	/**
	 * Registers a handler for a command.
	 */
	on(
		name: string | string[],
		handler: ServerRequestHandler<
			LSP.ExecuteCommandParams,
			unknown | undefined | null,
			never,
			void
		>,
	): Disposable {
		if (Array.isArray(name)) {
			this.#logger?.debug('Registering commands', { commands: name });

			for (const commandName of name) {
				this.#commands.set(commandName, handler);
			}

			return {
				dispose: () => {
					this.#logger?.debug('Deregistering commands', { commands: name });

					for (const commandName of name) {
						this.#commands.delete(commandName);
					}
				},
			};
		}

		this.#logger?.debug('Registering command', { command: name });

		this.#commands.set(name, handler);

		return {
			dispose: () => {
				this.#logger?.debug('Deregistering command', { command: name });

				this.#commands.delete(name);
			},
		};
	}

	/**
	 * Registers the command manager as a request handler.
	 */
	register(): void {
		this.#logger?.debug('Registering ExecuteCommandRequest handler');

		this.#connection.onExecuteCommand(async (...params) => {
			this.#logger?.debug('Received ExecuteCommandRequest', {
				command: params[0].command,
				arguments: params[0].arguments,
			});
			const handler = this.#commands.get(params[0].command);

			if (!handler) {
				this.#logger?.debug('No handler registered for command', {
					command: params[0].command,
				});

				return {};
			}

			this.#logger?.debug('Executing command', {
				command: params[0].command,
			});

			try {
				const response = await handler(...params);

				this.#logger?.debug('Sending command response', {
					command: params[0].command,
					response,
				});

				return response;
			} catch (error) {
				this.#logger?.error('Error executing command', {
					command: params[0].command,
					error,
				});

				return new LSP.ResponseError(
					LSP.ErrorCodes.InternalError,
					`Error executing command ${params[0].command}`,
					error,
				);
			}
		});

		this.#logger?.debug('ExecuteCommandRequest handler registered');
	}
}
