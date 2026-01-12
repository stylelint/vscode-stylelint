import { describe, expect, test, vi } from 'vitest';
import type * as LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocuments } from 'vscode-languageserver/node';

import { LanguageServerServiceRuntime } from '../lsp-service-runtime.js';
import type {
	CommandHandlerMetadata,
	InitializeHandler,
	LspServiceInstanceMetadata,
	TextDocumentEventHandler,
} from '../../decorators.js';
import { CommandId } from '../../types.js';
import type { CommandService } from '../../services/infrastructure/command.service.js';

const metadataKey = '__languageServerServiceMetadata__';

function createDisposable() {
	return {
		dispose: vi.fn(),
	};
}

function createMetadata(
	overrides: Partial<LspServiceInstanceMetadata> = {},
): LspServiceInstanceMetadata {
	return {
		commandHandlers: [],
		initializerHandlers: [],
		textDocumentHandlers: [],
		notificationHandlers: [],
		shutdownHandlers: [],
		connectionHandlers: [],
		disposables: [],
		...overrides,
	};
}

function createService(overrides: Partial<LspServiceInstanceMetadata> = {}) {
	const metadata = createMetadata(overrides);
	const instance = {
		[metadataKey]: metadata,
	};

	return { instance, metadata };
}

function createCommandService() {
	const disposable = createDisposable();
	let lastHandler: ((params: LSP.ExecuteCommandParams) => unknown) | undefined;
	const service = {
		on: vi.fn((_commandId: string, handler: (...args: unknown[]) => unknown) => {
			lastHandler = handler as (params: LSP.ExecuteCommandParams) => unknown;

			return disposable;
		}),
		register: vi.fn(),
		dispose: vi.fn(),
	} as unknown as CommandService & { on: ReturnType<typeof vi.fn> };

	return {
		service,
		getHandler: () => lastHandler,
	};
}

function createDocuments() {
	const disposable = createDisposable();
	const handlers: Partial<Record<'onDidClose', TextDocumentEventHandler>> = {};
	const documents = {
		onDidClose: vi.fn((handler: TextDocumentEventHandler) => {
			handlers.onDidClose = handler;

			return disposable;
		}),
	};

	return {
		documents: documents as unknown as TextDocuments<TextDocument>,
		handlers,
		disposable,
	};
}

describe('LanguageServerServiceRuntime', () => {
	test('registerService ignores instances without language server metadata', () => {
		const runtime = new LanguageServerServiceRuntime(createCommandService().service);

		runtime.registerService({});

		expect(() => runtime.registerCommandHandlers()).not.toThrow();
	});

	test('registerService throws when text document handlers require a missing TextDocuments instance', () => {
		const runtime = new LanguageServerServiceRuntime(createCommandService().service);
		const handler = vi.fn<TextDocumentEventHandler>();
		const { instance } = createService({
			textDocumentHandlers: [
				{
					event: 'onDidClose',
					handler,
				},
			],
		});

		expect(() => runtime.registerService(instance)).toThrow(/TextDocuments instance/);
	});

	test('registerService wires text document handlers and tracks their disposables', () => {
		const runtimeDocuments = createDocuments();
		const runtime = new LanguageServerServiceRuntime(createCommandService().service, {
			documents: runtimeDocuments.documents,
		});
		const handler = vi.fn<TextDocumentEventHandler>();
		const { instance, metadata } = createService({
			textDocumentHandlers: [
				{
					event: 'onDidClose',
					handler,
				},
			],
		});

		runtime.registerService(instance);

		expect(runtimeDocuments.documents.onDidClose).toHaveBeenCalledTimes(1);
		const wrapped = runtimeDocuments.handlers.onDidClose;

		expect(wrapped).toBeInstanceOf(Function);

		const event = { document: { uri: 'file:///doc.css' } } as never;

		void wrapped?.(event);

		expect(handler).toHaveBeenCalledWith(event);
		expect(metadata.disposables).toContain(runtimeDocuments.disposable);
	});

	test('runInitializers merges results contributed by services', () => {
		const initializeOne = vi
			.fn<InitializeHandler>()
			.mockReturnValue({ capabilities: { hoverProvider: true } });
		const initializeTwo = vi
			.fn<InitializeHandler>()
			.mockReturnValue({ capabilities: { codeActionProvider: true } });
		const { instance } = createService({
			initializerHandlers: [initializeOne, initializeTwo],
		});
		const runtime = new LanguageServerServiceRuntime(createCommandService().service);

		runtime.registerService(instance);
		const result = runtime.runInitializers({} as LSP.InitializeParams);

		expect(result).toBeDefined();
		expect(result?.capabilities).toMatchObject({
			hoverProvider: true,
			codeActionProvider: true,
		});
	});

	test('registerCommandHandlers installs handlers once and enforces minArgs requirements', async () => {
		const command = vi.fn().mockResolvedValue({ ok: true });
		const commandMetadata: CommandHandlerMetadata = {
			commandId: CommandId.ApplyAutoFix,
			methodName: 'handle',
			handler: command,
			options: { minArgs: 2 },
		};
		const { instance, metadata } = createService({ commandHandlers: [commandMetadata] });
		const commandService = createCommandService();
		const runtime = new LanguageServerServiceRuntime(commandService.service);

		runtime.registerService(instance);
		runtime.registerCommandHandlers();
		runtime.registerCommandHandlers();

		expect(commandService.service.on).toHaveBeenCalledTimes(1);
		expect(metadata.disposables).toHaveLength(1);

		const handler = commandService.getHandler()!;

		expect(await handler({ arguments: [1] } as LSP.ExecuteCommandParams)).toEqual({});
		expect(command).not.toHaveBeenCalled();

		expect(await handler({ arguments: [1, 2] } as LSP.ExecuteCommandParams)).toEqual({ ok: true });
		expect(command).toHaveBeenCalledWith(1, 2);
	});

	test('dispose runs shutdown handlers and disposes metadata resources', async () => {
		const shutdownSync = vi.fn();
		const shutdownAsync = vi.fn(() => Promise.resolve());
		const shutdownReject = vi.fn(() => Promise.reject(new Error('boom')));
		const disposableOne = createDisposable();
		const disposableTwo = createDisposable();
		const { instance, metadata } = createService({
			shutdownHandlers: [shutdownSync, shutdownAsync, shutdownReject],
			disposables: [disposableOne, disposableTwo] as LSP.Disposable[],
		});
		const runtime = new LanguageServerServiceRuntime(createCommandService().service);

		runtime.registerService(instance);
		runtime.dispose();

		expect(shutdownSync).toHaveBeenCalledTimes(1);
		expect(shutdownAsync).toHaveBeenCalledTimes(1);
		expect(shutdownReject).toHaveBeenCalledTimes(1);
		expect(disposableOne.dispose).toHaveBeenCalledTimes(1);
		expect(disposableTwo.dispose).toHaveBeenCalledTimes(1);
		expect(metadata.disposables).toHaveLength(0);
	});
});
