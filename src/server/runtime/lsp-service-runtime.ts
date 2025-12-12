import type { ServerRequestHandler } from 'vscode-languageserver';
import type * as LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocuments } from 'vscode-languageserver/node';
import { CommandService } from '../services/infrastructure/command.service.js';
import { mergeAssign } from '../utils/index.js';
import {
	CommandHandlerMetadata,
	getLanguageServerServiceMetadata,
	LspServiceInstanceMetadata,
	TextDocumentHandlerMetadata,
	type TextDocumentEventHandler,
} from '../decorators.js';

export interface LanguageServerServiceRuntimeOptions {
	documents?: TextDocuments<TextDocument>;
}

export class LanguageServerServiceRuntime {
	readonly #commands: CommandService;
	readonly #documents?: TextDocuments<TextDocument>;
	readonly #services = new Set<object>();
	#commandsRegistered = false;

	constructor(commands: CommandService, options: LanguageServerServiceRuntimeOptions = {}) {
		this.#commands = commands;
		this.#documents = options.documents;
	}

	registerService(service: object): void {
		if (!getLanguageServerServiceMetadata(service)) {
			return;
		}

		this.#services.add(service);
		this.#registerTextDocumentHandlers(service);
	}

	runInitializers(params: LSP.InitializeParams): Partial<LSP.InitializeResult> | undefined {
		let aggregated: Partial<LSP.InitializeResult> | undefined;

		for (const service of this.#services) {
			const metadata = getLanguageServerServiceMetadata(service);

			if (!metadata) {
				continue;
			}

			for (const initializer of metadata.initializerHandlers) {
				const result = initializer(params);

				if (!result) {
					continue;
				}

				if (!aggregated) {
					aggregated = { ...result };
					continue;
				}

				mergeAssign(aggregated, result);
			}
		}

		return aggregated;
	}

	registerCommandHandlers(): void {
		if (this.#commandsRegistered) {
			return;
		}

		for (const service of this.#services) {
			const metadata = getLanguageServerServiceMetadata(service);

			if (!metadata) {
				continue;
			}

			for (const handlerMetadata of metadata.commandHandlers) {
				const handler = this.#createCommandHandler(service, handlerMetadata);
				const disposable = this.#commands.on(handlerMetadata.commandId, handler);

				metadata.disposables.push(disposable);
			}
		}

		this.#commandsRegistered = true;
	}

	dispose(): void {
		for (const service of this.#services) {
			const metadata = getLanguageServerServiceMetadata(service);

			if (!metadata) {
				continue;
			}

			this.#runShutdownHandlers(metadata);
			this.#disposeMetadata(metadata);
		}

		this.#services.clear();
	}

	#disposeMetadata(metadata: LspServiceInstanceMetadata): void {
		for (const disposable of metadata.disposables) {
			try {
				disposable.dispose();
			} catch {
				// Best effort cleanup.
			}
		}

		metadata.disposables.length = 0;
	}

	#createCommandHandler(
		_service: object,
		descriptor: CommandHandlerMetadata,
	): ServerRequestHandler<LSP.ExecuteCommandParams, unknown, never, void> {
		return async (params: LSP.ExecuteCommandParams) => {
			const args = params.arguments ?? [];
			const minArgs = descriptor.options?.minArgs;

			if (typeof minArgs === 'number' && args.length < minArgs) {
				return {};
			}

			// Argument type checking is not performed here; it is the
			// responsibility of the command handler to validate arguments.
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			const result = descriptor.handler(...args) as unknown;
			const awaited = await Promise.resolve(result);

			return awaited ?? {};
		};
	}

	#registerTextDocumentHandlers(service: object): void {
		const metadata = getLanguageServerServiceMetadata(service);

		if (!metadata || metadata.textDocumentHandlers.length === 0) {
			return;
		}

		if (!this.#documents) {
			throw new Error(
				'@textDocumentEvent() requires a TextDocuments instance. Provide one when creating LanguageServerServiceDecoratorsHost.',
			);
		}

		for (const descriptor of metadata.textDocumentHandlers) {
			const disposable = this.#registerTextDocumentHandler(descriptor);

			metadata.disposables.push(disposable);
		}
	}

	#registerTextDocumentHandler(descriptor: TextDocumentHandlerMetadata): LSP.Disposable {
		const documents = this.#documents!;
		const wrappedHandler = (event: Parameters<TextDocumentEventHandler>[0]): void => {
			void descriptor.handler(event)?.catch(() => {
				// Ignore errors from async handlers to avoid crashing document events.
			});
		};

		const registrar = documents[descriptor.event] as (
			handler: (event: Parameters<TextDocumentEventHandler>[0]) => void,
		) => LSP.Disposable;

		return registrar(wrappedHandler);
	}

	#runShutdownHandlers(metadata: LspServiceInstanceMetadata): void {
		for (const handler of metadata.shutdownHandlers) {
			try {
				const result = handler();

				if (result && typeof (result as Promise<unknown>).then === 'function') {
					void (result as Promise<unknown>).catch(() => {
						// Suppress shutdown handler errors during disposal.
					});
				}
			} catch {
				// Ignore failures to ensure shutdown continues.
			}
		}
	}
}
