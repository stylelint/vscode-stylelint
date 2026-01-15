import { beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Disposable } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocumentChangeEvent } from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';

import {
	createDocumentFixesServiceStub,
	createLoggingServiceStub,
	createStylelintRunnerStub,
	createTextDocumentsStore,
	createWorkspaceOptionsStub,
	type DocumentFixesServiceStub,
	type StylelintRunnerStub,
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
import { StylelintRunnerService } from '../../stylelint-runtime/stylelint-runner.service.js';
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
	windowInfoMessages: string[];
	showDocumentCalls: Array<{ uri: string; external?: boolean }>;
};

function createFormattingConnectionStub(): FormattingConnectionStub {
	const clientRegisterCalls: FormattingConnectionStub['clientRegisterCalls'] = [];
	const sendNotificationCalls: FormattingConnectionStub['sendNotificationCalls'] = [];
	const windowInfoMessages: string[] = [];
	const showDocumentCalls: FormattingConnectionStub['showDocumentCalls'] = [];

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
			showInformationMessage: async (
				message: string,
				..._items: Array<LSP.MessageActionItem | string>
			): Promise<LSP.MessageActionItem | string | undefined> => {
				windowInfoMessages.push(message);

				return undefined;
			},
			showDocument: async (params: { uri: string; external?: boolean }) => {
				showDocumentCalls.push(params);

				return { success: true };
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
		windowInfoMessages,
		showDocumentCalls,
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
	let runner: StylelintRunnerStub;
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
		runner = createStylelintRunnerStub();
		connection = createFormattingConnectionStub();
		logger = createTestLogger();
		loggingService = createLoggingServiceStub(logger);

		const container = createContainer(
			module({
				register: [
					provideTestValue(textDocumentsToken, () => documents),
					provideTestValue(WorkspaceOptionsService, () => options),
					provideTestValue(DocumentFixesService, () => fixes),
					provideTestValue(StylelintRunnerService, () => runner),
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

	it('with Stylelint 16+, should show info message and return null', async () => {
		const document = setDocument('a {}', 'css', 'file:///foo.css');

		options.setValidateLanguages([document.languageId]);
		runner.setResolution(document.uri, {
			entryPath: '/workspace/node_modules/stylelint/index.js',
			resolvedPath: '/workspace/node_modules/stylelint',
			version: '16.0.0',
		});
		fixes.setFixes(document.uri, [LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);

		const result = await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});

		expect(result).toBeNull();
		expect(fixes.calls).toHaveLength(0);
		expect(connection.windowInfoMessages).toHaveLength(1);
		expect(connection.windowInfoMessages[0]).toContain("doesn't include stylistic rules");
		expect(connection.windowInfoMessages[0]).toContain('16.0.0');
		expect(connection.windowInfoMessages[0]).toContain('Fix all auto-fixable problems');
	});

	it('with Stylelint 17+, should show info message and return null', async () => {
		const document = setDocument('a {}', 'css', 'file:///foo.css');

		options.setValidateLanguages([document.languageId]);
		runner.setResolution(document.uri, {
			entryPath: '/workspace/node_modules/stylelint/index.js',
			resolvedPath: '/workspace/node_modules/stylelint',
			version: '17.2.0',
		});

		const result = await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});

		expect(result).toBeNull();
		expect(connection.windowInfoMessages).toHaveLength(1);
		expect(connection.windowInfoMessages[0]).toContain('17.2.0');
	});

	it('with Stylelint 15.x, should format normally', async () => {
		const document = setDocument('a {}', 'css', 'file:///foo.css');

		options.setValidateLanguages([document.languageId]);
		runner.setResolution(document.uri, {
			entryPath: '/workspace/node_modules/stylelint/index.js',
			resolvedPath: '/workspace/node_modules/stylelint',
			version: '15.11.0',
		});
		fixes.setFixes(document.uri, [LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);

		const result = await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});

		expect(result).toEqual([LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);
		expect(fixes.calls).toHaveLength(1);
		expect(connection.windowInfoMessages).toHaveLength(0);
	});

	it('with Stylelint 14.x, should format normally', async () => {
		const document = setDocument('a {}', 'css', 'file:///foo.css');

		options.setValidateLanguages([document.languageId]);
		runner.setResolution(document.uri, {
			entryPath: '/workspace/node_modules/stylelint/index.js',
			resolvedPath: '/workspace/node_modules/stylelint',
			version: '14.0.0',
		});
		fixes.setFixes(document.uri, [LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);

		const result = await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});

		expect(result).toEqual([LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);
		expect(connection.windowInfoMessages).toHaveLength(0);
	});

	it('with Stylelint version unknown, should format normally', async () => {
		const document = setDocument('a {}', 'css', 'file:///foo.css');

		options.setValidateLanguages([document.languageId]);
		runner.setResolution(document.uri, {
			entryPath: '/workspace/node_modules/stylelint/index.js',
			resolvedPath: '/workspace/node_modules/stylelint',
			version: undefined,
		});
		fixes.setFixes(document.uri, [LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);

		const result = await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});

		expect(result).toEqual([LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);
		expect(connection.windowInfoMessages).toHaveLength(0);
	});

	it('with Stylelint resolution unavailable, should format normally', async () => {
		const document = setDocument('a {}', 'css', 'file:///foo.css');

		options.setValidateLanguages([document.languageId]);
		// No resolution set, so it will return undefined.
		fixes.setFixes(document.uri, [LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);

		const result = await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});

		expect(result).toEqual([LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);
		expect(connection.windowInfoMessages).toHaveLength(0);
	});

	it('with Stylelint 16+, should only warn once per document', async () => {
		const document = setDocument('a {}', 'css', 'file:///foo.css');

		options.setValidateLanguages([document.languageId]);
		runner.setResolution(document.uri, {
			entryPath: '/workspace/node_modules/stylelint/index.js',
			resolvedPath: '/workspace/node_modules/stylelint',
			version: '16.5.0',
		});

		await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});
		await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});
		await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});

		// Should only show the message once, not three times.
		expect(connection.windowInfoMessages).toHaveLength(1);
	});

	it('with Stylelint 16+ beta version, should show info message', async () => {
		const document = setDocument('a {}', 'css', 'file:///foo.css');

		options.setValidateLanguages([document.languageId]);
		runner.setResolution(document.uri, {
			entryPath: '/workspace/node_modules/stylelint/index.js',
			resolvedPath: '/workspace/node_modules/stylelint',
			version: '16.0.0-beta.1',
		});

		const result = await service.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});

		expect(result).toBeNull();
		expect(connection.windowInfoMessages).toHaveLength(1);
	});

	it('with Stylelint 16+ and showDocument support, should offer Learn more button', async () => {
		// Create a new service with showDocument capability.
		const showDocumentCalls: Array<{ uri: string; external?: boolean }> = [];
		const learnMoreInfoMessages: string[] = [];

		const learnMoreConnection = {
			...connection.connection,
			window: {
				...connection.connection.window,
				showInformationMessage: async (
					message: string,
					...items: Array<LSP.MessageActionItem | string>
				): Promise<LSP.MessageActionItem | string | undefined> => {
					learnMoreInfoMessages.push(message);

					// Simulate clicking the "Learn more" button.
					if (items.length > 0 && typeof items[0] === 'object' && items[0].title === 'Learn more') {
						return items[0];
					}

					return undefined;
				},
				showDocument: async (params: { uri: string; external?: boolean }) => {
					showDocumentCalls.push(params);

					return { success: true };
				},
			},
		} as unknown as Connection;

		const learnMoreContainer = createContainer(
			module({
				register: [
					provideTestValue(textDocumentsToken, () => documents),
					provideTestValue(WorkspaceOptionsService, () => options),
					provideTestValue(DocumentFixesService, () => fixes),
					provideTestValue(StylelintRunnerService, () => runner),
					provideTestValue(lspConnectionToken, () => learnMoreConnection),
					provideTestValue(UriModuleToken, () => createFormatterUriDependency()),
					provideTestValue(loggingServiceToken, () => loggingService),
					NotificationService,
					FormatterLspService,
				],
			}),
		);

		const learnMoreService = learnMoreContainer.resolve(FormatterLspService);

		// Initialize with showDocument support.
		learnMoreService.onInitialize({
			capabilities: {
				window: { showDocument: { support: true } },
			},
		} as LSP.InitializeParams);

		const document = setDocument('a {}', 'css', 'file:///learn-more.css');

		options.setValidateLanguages([document.languageId]);
		runner.setResolution(document.uri, {
			entryPath: '/workspace/node_modules/stylelint/index.js',
			resolvedPath: '/workspace/node_modules/stylelint',
			version: '16.5.0',
		});

		await learnMoreService.handleDocumentFormatting({
			textDocument: { uri: document.uri },
			options: { insertSpaces: true, tabSize: 2 },
		});

		expect(learnMoreInfoMessages).toHaveLength(1);
		expect(showDocumentCalls).toHaveLength(1);
		expect(showDocumentCalls[0].uri).toContain('github.com/stylelint/vscode-stylelint');
		expect(showDocumentCalls[0].uri).toContain('document-formatting');
		expect(showDocumentCalls[0].external).toBe(true);
	});
});
