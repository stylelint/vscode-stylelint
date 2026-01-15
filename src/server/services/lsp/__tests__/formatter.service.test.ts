import { beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Disposable } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocumentChangeEvent } from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';

import {
	createDocumentFixesServiceStub,
	createLoggingServiceStub,
	createTextDocumentsStore,
	createWorkspaceOptionsStub,
	type DocumentFixesServiceStub,
	type TextDocumentsStore,
	type WorkspaceOptionsServiceStub,
} from '../../../../../test/helpers/stubs/index.js';
import { createTestLogger, type TestLogger } from '../../../../../test/helpers/test-logger.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { lspConnectionToken, textDocumentsToken, UriModuleToken } from '../../../tokens.js';
import { Notification } from '../../../types.js';
import { DocumentFixesService } from '../../documents/document-fixes.service.js';
import { type LoggingService, loggingServiceToken } from '../../infrastructure/logging.service.js';
import { NotificationService } from '../../infrastructure/notification.service.js';
import { WorkspaceOptionsService } from '../../workspace/workspace-options.service.js';
import { FormatterLspService } from '../formatter.service.js';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

type FormattingConnectionStub = {
	connection: Connection;
	clientRegisterCalls: Array<{
		type: typeof LSP.DocumentFormattingRequest;
		options: LSP.DocumentFormattingRegistrationOptions;
		disposable: Disposable & { disposed: boolean };
	}>;
	sendNotificationCalls: Array<{
		method: string | LSP.ProtocolNotificationType<unknown, unknown>;
		params: unknown;
	}>;
};

function createFormattingConnectionStub(): FormattingConnectionStub {
	const clientRegisterCalls: FormattingConnectionStub['clientRegisterCalls'] = [];
	const sendNotificationCalls: FormattingConnectionStub['sendNotificationCalls'] = [];

	const connection = {
		client: {
			register: async (
				type: typeof LSP.DocumentFormattingRequest,
				options: LSP.DocumentFormattingRegistrationOptions,
			) => {
				const disposable: Disposable & { disposed: boolean } = {
					disposed: false,
					dispose() {
						this.disposed = true;
					},
				};

				clientRegisterCalls.push({ type, options, disposable });

				return disposable;
			},
		},
		window: {
			sendNotification: async (
				method: string | LSP.ProtocolNotificationType<unknown, unknown>,
				params: unknown,
			) => {
				sendNotificationCalls.push({ method, params });
			},
		},
		sendNotification: async (
			method: string | LSP.ProtocolNotificationType<unknown, unknown>,
			params?: unknown,
		) => {
			sendNotificationCalls.push({ method, params });
		},
		onDocumentFormatting: () => ({ dispose() {} }) as LSP.Disposable,
		onNotification: () => ({ dispose() {} }) as LSP.Disposable,
	} as unknown as Connection;

	return {
		connection,
		clientRegisterCalls,
		sendNotificationCalls,
	};
}

function createFormatterUriDependency(): Pick<typeof URI, 'parse'> {
	return {
		parse: (uri: string) => {
			const parsed = URI.parse(uri);

			if (parsed.scheme === 'file') {
				return parsed;
			}

			const windowsPath = parsed.fsPath?.replace(/\//g, '\\\\');

			if (windowsPath) {
				Object.defineProperty(parsed, 'fsPath', {
					value: windowsPath,
					configurable: true,
					enumerable: true,
					writable: false,
				});
			}

			return parsed;
		},
	};
}

function createDocumentFilter(uri: string): LSP.DocumentFilter {
	const parsed = createFormatterUriDependency().parse(uri);
	const basePath =
		parsed.scheme === 'file'
			? (parsed.fsPath ?? parsed.path ?? '')
			: (parsed.path ?? parsed.fsPath ?? '');
	const normalizedPath = basePath.replace(/\\/g, '/');
	const pattern = normalizedPath.replace(/[[\]{}]/g, '?');

	return {
		scheme: parsed.scheme,
		pattern,
	};
}

describe('FormatterLspModule', () => {
	let service: FormatterLspService;
	let documents: TextDocumentsStore;
	let options: WorkspaceOptionsServiceStub;
	let fixes: DocumentFixesServiceStub;
	let connection: FormattingConnectionStub;
	let logger: TestLogger;
	let loggingService: LoggingService;

	const setDocument = (
		content = 'a {}',
		languageId = 'css',
		uri = 'file:///dir/test.css',
	): TextDocument => {
		const document = TextDocument.create(uri, languageId, 1, content);

		documents.set(document);

		return document;
	};

	const setDynamicRegistration = (enabled: boolean) => {
		service.onInitialize({
			capabilities: {
				textDocument: { formatting: { dynamicRegistration: enabled } },
			},
		} as LSP.InitializeParams);
	};

	const createChangeEvent = (document: TextDocument): TextDocumentChangeEvent<TextDocument> => ({
		document,
	});

	beforeEach(() => {
		documents = createTextDocumentsStore();
		options = createWorkspaceOptionsStub();
		fixes = createDocumentFixesServiceStub();
		connection = createFormattingConnectionStub();
		logger = createTestLogger();
		loggingService = createLoggingServiceStub(logger);

		const container = createContainer(
			module({
				register: [
					provideTestValue(textDocumentsToken, () => documents),
					provideTestValue(WorkspaceOptionsService, () => options),
					provideTestValue(DocumentFixesService, () => fixes),
					provideTestValue(lspConnectionToken, () => connection.connection),
					provideTestValue(UriModuleToken, () => createFormatterUriDependency()),
					provideTestValue(loggingServiceToken, () => loggingService),
					NotificationService,
					FormatterLspService,
				],
			}),
		);

		service = container.resolve(FormatterLspService);
	});

	it('should be constructable', () => {
		expect(service).toBeInstanceOf(FormatterLspService);
	});

	it('without client dynamic registration, onInitialize requests static capability', () => {
		const result = service.onInitialize({
			capabilities: {
				textDocument: { formatting: { dynamicRegistration: false } },
			},
		} as LSP.InitializeParams);

		expect(result).toMatchSnapshot();
	});

	it('with client dynamic registration, onInitialize disables static capability', () => {
		const result = service.onInitialize({
			capabilities: {
				textDocument: { formatting: { dynamicRegistration: true } },
			},
		} as LSP.InitializeParams);

		expect(result).toMatchSnapshot();
	});

	it('should format documents', async () => {
		const document = setDocument('a {}', 'css', 'file:///foo.css');

		options.setValidateLanguages([document.languageId]);
		fixes.setFixes(document.uri, [LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);

		const result = await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: {
				insertSpaces: true,
				tabSize: 2,
				insertFinalNewline: true,
				trimFinalNewlines: false,
			},
		});

		expect(result).toMatchSnapshot();
		expect(fixes.calls.map((call) => call.document)).toEqual([document]);
		expect(fixes.calls[0]?.options).toMatchSnapshot();
	});

	it('should merge resolved config with formatting rules', async () => {
		const document = setDocument('a {}', 'css', 'file:///foo.css');

		options.setValidateLanguages([document.languageId]);
		fixes.setFixes(document.uri, [LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);
		fixes.setResolvedConfig(document.uri, {
			customSyntax: 'postcss-scss',
			rules: {
				'color-no-invalid-hex': true,
			},
		});

		await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: {
				insertSpaces: true,
				tabSize: 2,
				insertFinalNewline: true,
				trimFinalNewlines: false,
			},
		});

		expect(fixes.resolveConfigCalls).toHaveLength(1);
		expect(fixes.resolveConfigCalls[0]?.document).toEqual(document);

		const passedOptions = fixes.calls[0]?.options as { config?: unknown };

		expect(passedOptions?.config).toEqual({
			customSyntax: 'postcss-scss',
			rules: {
				indentation: [2],
				'no-missing-end-of-source-newline': true,
			},
		});
	});

	it('should use only formatting rules when resolveConfig returns undefined', async () => {
		const document = setDocument('a {}', 'css', 'file:///foo.css');

		options.setValidateLanguages([document.languageId]);
		fixes.setFixes(document.uri, [LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);
		// Do not set a resolved config - it will return undefined

		await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: {
				insertSpaces: true,
				tabSize: 2,
				insertFinalNewline: true,
				trimFinalNewlines: false,
			},
		});

		expect(fixes.resolveConfigCalls).toHaveLength(1);

		// Should still have a config with formatting rules
		const passedOptions = fixes.calls[0]?.options as { config?: unknown };

		expect(passedOptions?.config).toEqual({
			rules: {
				indentation: [2],
				'no-missing-end-of-source-newline': true,
			},
		});
	});

	it('with no text document, should not attempt to format', async () => {
		const result = await service.handleDocumentFormatting({
			textDocument: undefined as unknown as LSP.TextDocumentIdentifier,
			options: { insertSpaces: true, tabSize: 2 },
		});

		expect(result).toBeNull();
		expect(fixes.calls).toHaveLength(0);
		const noDocumentCall = logger.debug.mock.calls.at(-1);

		expect(noDocumentCall).toEqual(['No text document provided, ignoring']);
	});

	it('if no matching document exists, should not attempt to format', async () => {
		const result = await service.handleDocumentFormatting({
			textDocument: { uri: 'file:///missing.css' },
			options: { insertSpaces: true, tabSize: 2 },
		});

		expect(result).toBeNull();
		const missingDocumentCall = logger.debug.mock.calls.at(-1);

		expect(missingDocumentCall).toEqual([
			'Unknown document, ignoring',
			{ uri: 'file:///missing.css' },
		]);
	});

	it('if document language ID is not validated, should not attempt to format', async () => {
		const document = setDocument();

		options.setValidateLanguages(['scss']);

		const result = await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});

		expect(result).toBeNull();
		const skippedDocumentCall = logger.debug.mock.calls.at(-1);

		expect(skippedDocumentCall).toEqual([
			'Document should not be formatted, ignoring',
			{ uri: document.uri, language: document.languageId },
		]);
	});

	it('with no debug log level and invalid document, should not log skip reason', async () => {
		const document = setDocument();

		options.setValidateLanguages([]);
		logger.setDebugEnabled(false);

		await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});

		const debugCalls = logger.debug.mock.calls as unknown as Array<[string, unknown]>;

		expect(
			debugCalls.some(([message]) => message === 'Document should not be formatted, ignoring'),
		).toBe(false);
	});

	it('with dynamic registration disabled, handleDocumentRegistration should not register', async () => {
		setDynamicRegistration(false);
		const document = setDocument();

		await service.handleDocumentRegistration(createChangeEvent(document));
		await flushPromises();

		expect(connection.clientRegisterCalls).toHaveLength(0);
	});

	it('with dynamic registration enabled, handleDocumentRegistration registers per document', async () => {
		setDynamicRegistration(true);
		const fileDocument = setDocument('a {}', 'css', 'file:///dir/test.css');
		const schemeDocument = setDocument('a {}', 'css', 'custom:///dir/test.css');

		options.setValidateLanguages(['css']);

		await service.handleDocumentRegistration(createChangeEvent(fileDocument));
		await service.handleDocumentRegistration(createChangeEvent(schemeDocument));
		await flushPromises();

		expect(connection.clientRegisterCalls).toMatchSnapshot();
		expect(connection.sendNotificationCalls).toEqual([
			{
				method: Notification.DidRegisterDocumentFormattingEditProvider,
				params: {
					uri: fileDocument.uri,
					options: {
						documentSelector: [createDocumentFilter(fileDocument.uri)],
					},
				},
			},
			{
				method: Notification.DidRegisterDocumentFormattingEditProvider,
				params: {
					uri: schemeDocument.uri,
					options: {
						documentSelector: [createDocumentFilter(schemeDocument.uri)],
					},
				},
			},
		]);
	});

	it('handleDocumentClosed should dispose existing registrations', async () => {
		setDynamicRegistration(true);
		const document = setDocument();

		options.setValidateLanguages([document.languageId]);

		await service.handleDocumentRegistration(createChangeEvent(document));
		await flushPromises();

		service.handleDocumentClosed(createChangeEvent(document));
		await flushPromises();

		expect(connection.clientRegisterCalls[0]?.disposable.disposed).toBe(true);
	});

	it('deregisterAll should dispose every registration', async () => {
		setDynamicRegistration(true);
		const first = setDocument('a {}', 'css', 'file:///one.css');
		const second = setDocument('a {}', 'css', 'file:///two.css');

		options.setValidateLanguages(['css']);

		await service.handleDocumentRegistration(createChangeEvent(first));
		await service.handleDocumentRegistration(createChangeEvent(second));
		await flushPromises();

		service.deregisterAll();
		await flushPromises();

		expect(connection.clientRegisterCalls.every((call) => call.disposable.disposed)).toBe(true);
	});
});
