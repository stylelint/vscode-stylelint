import { describe, expect, test } from 'vitest';
import type LSP from 'vscode-languageserver-protocol';

import {
	codeActionRequest,
	command,
	completionRequest,
	documentFormattingRequest,
	getLanguageServerServiceMetadata,
	initialize,
	isLanguageServerServiceConstructor,
	isLanguageServerServiceInstance,
	lspService,
	notification,
	shutdown,
	textDocumentEvent,
} from '../decorators.js';
import { CommandId } from '../types.js';

describe('server decorators', () => {
	test('collects metadata from decorated services', async () => {
		@lspService()
		class ExampleService {
			value = 0;

			@command(CommandId.ApplyAutoFix, { minArgs: 1 })
			invokeCommand(amount: number): number {
				this.value += amount;

				return this.value;
			}

			@initialize()
			onInitialize(): Partial<LSP.InitializeResult> | void {
				this.value += 10;

				return { capabilities: { experimental: { ready: true } } };
			}

			@textDocumentEvent('onDidSave')
			async onDidSave(): Promise<void> {
				this.value += 100;
			}

			@notification('stylelint/customNotification')
			async onCustomNotification(): Promise<void> {
				this.value += 1000;
			}

			@notification()
			async onAnyNotification(): Promise<void> {
				this.value += 10000;
			}

			@completionRequest()
			async provideCompletion(
				_: LSP.CompletionParams,
			): Promise<LSP.CompletionItem[] | LSP.CompletionList | null | undefined> {
				this.value += 2;

				return [];
			}

			@codeActionRequest()
			async provideCodeAction(
				_: LSP.CodeActionParams,
			): Promise<(LSP.Command | LSP.CodeAction)[] | null | undefined> {
				this.value += 3;

				return null;
			}

			@documentFormattingRequest()
			async formatDocument(
				_: LSP.DocumentFormattingParams,
			): Promise<LSP.TextEdit[] | null | undefined> {
				this.value += 4;

				return undefined;
			}

			@shutdown()
			onShutdown(): void {
				this.value = -1;
			}
		}

		expect(isLanguageServerServiceConstructor(ExampleService)).toBe(true);

		const instance = new ExampleService();
		const metadata = getLanguageServerServiceMetadata(instance);

		expect(metadata).toBeDefined();
		expect(isLanguageServerServiceInstance(instance)).toBe(true);
		expect(metadata?.commandHandlers).toHaveLength(1);
		expect(metadata?.commandHandlers[0]).toMatchObject({
			commandId: CommandId.ApplyAutoFix,
			methodName: 'invokeCommand',
			options: { minArgs: 1 },
		});

		const commandResult = metadata?.commandHandlers[0]?.handler<number>(5);

		expect(commandResult).toBe(5);
		expect(instance.value).toBe(5);

		expect(metadata?.initializerHandlers).toHaveLength(1);
		const initResult = metadata?.initializerHandlers[0]?.();

		expect(initResult).toEqual({ capabilities: { experimental: { ready: true } } });
		expect(instance.value).toBe(15);

		expect(metadata?.textDocumentHandlers).toEqual([
			{ event: 'onDidSave', handler: expect.any(Function) },
		]);
		await metadata?.textDocumentHandlers[0]?.handler({} as never);
		expect(instance.value).toBe(115);

		expect(metadata?.notificationHandlers).toHaveLength(2);
		expect(metadata?.notificationHandlers[0]).toMatchObject({
			type: 'stylelint/customNotification',
			handler: expect.any(Function),
		});
		await metadata?.notificationHandlers[0]?.handler();
		expect(instance.value).toBe(1115);

		await metadata?.notificationHandlers[1]?.handler();
		expect(instance.value).toBe(11115);

		expect(metadata?.connectionHandlers.map((descriptor) => descriptor.kind)).toEqual([
			'completion',
			'codeAction',
			'documentFormatting',
		]);

		for (const descriptor of metadata?.connectionHandlers ?? []) {
			await descriptor.handler({} as never);
		}

		expect(instance.value).toBe(11124);

		expect(metadata?.shutdownHandlers).toHaveLength(1);
		await metadata?.shutdownHandlers[0]?.();
		expect(instance.value).toBe(-1);

		expect(metadata?.disposables).toEqual([]);
	});

	test('decorators require @lspService()', () => {
		class InvalidService {
			@command(CommandId.ApplyAutoFix)
			invoke(): void {}
		}

		expect(() => new InvalidService()).toThrow(
			'@lspService() must decorate a class before using language server service decorators.',
		);
	});

	test('non-decorated classes are not language server services', () => {
		class PlainService {}

		expect(isLanguageServerServiceConstructor(PlainService)).toBe(false);
		expect(isLanguageServerServiceInstance(new PlainService())).toBe(false);
		expect(getLanguageServerServiceMetadata(new PlainService())).toBeUndefined();
	});
});
