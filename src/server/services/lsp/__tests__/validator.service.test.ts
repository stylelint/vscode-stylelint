import { beforeEach, describe, expect, it } from 'vitest';
import type { Connection } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocumentChangeEvent } from 'vscode-languageserver/node';

import {
	createDocumentDiagnosticsServiceStub,
	createLoggingServiceStub,
	createStylelintRunnerStub,
	createTextDocumentsStore,
	createWorkspaceOptionsStub,
	type DocumentDiagnosticsServiceStub,
	type StylelintRunnerStub,
	type TextDocumentsStore,
	type WorkspaceOptionsServiceStub,
} from '../../../../../test/helpers/stubs/index.js';
import { createTestLogger, type TestLogger } from '../../../../../test/helpers/test-logger.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { getLanguageServerServiceMetadata } from '../../../decorators.js';
import type { LintDiagnostics } from '../../../stylelint/index.js';
import { lspConnectionToken, textDocumentsToken } from '../../../tokens.js';
import { DocumentDiagnosticsService } from '../../documents/document-diagnostics.service.js';
import { type LoggingService, loggingServiceToken } from '../../infrastructure/logging.service.js';
import { NotificationService } from '../../infrastructure/notification.service.js';
import { StylelintRunnerService } from '../../stylelint-runtime/stylelint-runner.service.js';
import { WorkspaceOptionsService } from '../../workspace/workspace-options.service.js';
import { ValidatorLspService } from '../validator.service.js';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

type DiagnosticsConnectionStub = {
	connection: Connection;
	sendDiagnosticsCalls: Array<{ uri: string; diagnostics: LSP.Diagnostic[] }>;
	windowMessages: string[];
	setSendDiagnosticsError(error: unknown): void;
};

function createDiagnosticsConnectionStub(): DiagnosticsConnectionStub {
	const sendDiagnosticsCalls: DiagnosticsConnectionStub['sendDiagnosticsCalls'] = [];
	const windowMessages: string[] = [];
	let sendDiagnosticsError: unknown;

	const connection = {
		sendDiagnostics: async (params: LSP.PublishDiagnosticsParams) => {
			if (sendDiagnosticsError) {
				// Presuming to be an Error instance.
				// eslint-disable-next-line @typescript-eslint/only-throw-error
				throw sendDiagnosticsError;
			}

			sendDiagnosticsCalls.push({ uri: params.uri, diagnostics: params.diagnostics });
		},
		window: {
			showErrorMessage: async (message: string) => {
				windowMessages.push(message);
			},
		},
		onNotification: () => ({ dispose() {} }) as LSP.Disposable,
	} as unknown as Connection;

	return {
		connection,
		sendDiagnosticsCalls,
		windowMessages,
		setSendDiagnosticsError: (error: unknown) => {
			sendDiagnosticsError = error;
		},
	};
}

function createDiagnosticsResult(diagnostics: LSP.Diagnostic[]): LintDiagnostics {
	return { diagnostics };
}

function createDiagnostic(message: string): LSP.Diagnostic {
	return {
		message,
		range: {
			start: { line: 0, character: 0 },
			end: { line: 0, character: 0 },
		},
	};
}

describe('ValidatorLspModule', () => {
	let service: ValidatorLspService;
	let documents: TextDocumentsStore;
	let options: WorkspaceOptionsServiceStub;
	let diagnostics: DocumentDiagnosticsServiceStub;
	let runner: StylelintRunnerStub;
	let connection: DiagnosticsConnectionStub;
	let logger: TestLogger;
	let loggingService: LoggingService;

	const setDocument = (
		content = 'a {}',
		languageId = 'css',
		uri = 'file:///test.css',
	): TextDocument => {
		const document = TextDocument.create(uri, languageId, 1, content);

		documents.set(document);

		return document;
	};

	const createChangeEvent = (document: TextDocument): TextDocumentChangeEvent<TextDocument> => ({
		document,
	});

	const invokeNotification = async (
		type: LSP.ProtocolNotificationType<unknown, unknown>,
	): Promise<void> => {
		const metadata = getLanguageServerServiceMetadata(service);
		const handler = metadata?.notificationHandlers.find(
			(descriptor) => descriptor.type === type,
		)?.handler;

		if (!handler) {
			throw new Error('Notification handler not registered');
		}

		await handler();
	};

	beforeEach(() => {
		documents = createTextDocumentsStore();
		options = createWorkspaceOptionsStub();
		diagnostics = createDocumentDiagnosticsServiceStub();
		runner = createStylelintRunnerStub();
		connection = createDiagnosticsConnectionStub();
		logger = createTestLogger();
		loggingService = createLoggingServiceStub(logger);

		const container = createContainer(
			module({
				register: [
					provideTestValue(textDocumentsToken, () => documents),
					provideTestValue(WorkspaceOptionsService, () => options),
					provideTestValue(DocumentDiagnosticsService, () => diagnostics),
					provideTestValue(StylelintRunnerService, () => runner),
					provideTestValue(lspConnectionToken, () => connection.connection),
					provideTestValue(loggingServiceToken, () => loggingService),
					NotificationService,
					ValidatorLspService,
				],
			}),
		);

		service = container.resolve(ValidatorLspService);
	});

	it('should be constructable', () => {
		expect(service).toBeInstanceOf(ValidatorLspService);
	});

	it('onInitialize should validate all documents', async () => {
		const first = setDocument('a {}', 'css', 'file:///foo.css');
		const second = setDocument('b {}', 'css', 'file:///bar.css');
		const firstDiagnostics = [createDiagnostic('first')];
		const secondDiagnostics = [createDiagnostic('second')];

		options.setValidateLanguages(['css']);
		runner.setLintResult(first.uri, createDiagnosticsResult(firstDiagnostics));
		runner.setLintResult(second.uri, createDiagnosticsResult(secondDiagnostics));

		service.onInitialize();
		await flushPromises();

		expect(connection.sendDiagnosticsCalls).toEqual([
			{ uri: first.uri, diagnostics: firstDiagnostics },
			{ uri: second.uri, diagnostics: secondDiagnostics },
		]);
	});

	it('handleDocumentChanged should skip validation when language is not enabled', async () => {
		const document = setDocument();

		options.setValidateLanguages(['scss']);

		await service.handleDocumentChanged(createChangeEvent(document));

		expect(runner.lintCalls).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('Document should not be validated, ignoring', {
			uri: document.uri,
			language: document.languageId,
		});
	});

	it('handleDocumentChanged should clear diagnostics when language no longer enabled', async () => {
		const document = setDocument();

		options.setValidateLanguages([]);
		diagnostics.setCachedDiagnostics(document.uri, [{ message: 'existing' } as LSP.Diagnostic]);

		await service.handleDocumentChanged(createChangeEvent(document));

		expect(diagnostics.clearCalls).toEqual([document.uri]);
		expect(connection.sendDiagnosticsCalls.at(-1)).toEqual({
			uri: document.uri,
			diagnostics: [],
		});
	});

	it('handleDocumentChanged should send diagnostics when lint result exists', async () => {
		const document = setDocument();
		const lintDiagnostics = [createDiagnostic('lint')];

		options.setValidateLanguages(['css']);
		runner.setLintResult(document.uri, createDiagnosticsResult(lintDiagnostics));

		await service.handleDocumentChanged(createChangeEvent(document));

		expect(connection.sendDiagnosticsCalls).toEqual([
			{ uri: document.uri, diagnostics: lintDiagnostics },
		]);
		expect(diagnostics.setCalls).toEqual([{ document, diagnostics: lintDiagnostics }]);
	});

	it('handleDocumentChanged should log when lint result is empty', async () => {
		const document = setDocument();

		options.setValidateLanguages(['css']);
		runner.setLintResult(document.uri, undefined);

		await service.handleDocumentChanged(createChangeEvent(document));

		expect(connection.sendDiagnosticsCalls).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('No lint result, ignoring', {
			uri: document.uri,
		});
	});

	it('handleDocumentChanged should report sendDiagnostics errors', async () => {
		const document = setDocument();
		const error = new Error('send failed');

		options.setValidateLanguages(['css']);
		runner.setLintResult(document.uri, createDiagnosticsResult([createDiagnostic('lint')]));
		connection.setSendDiagnosticsError(error);

		await service.handleDocumentChanged(createChangeEvent(document));

		expect(connection.windowMessages).toHaveLength(1);
		expect(logger.error).toHaveBeenLastCalledWith('Failed to send diagnostics', {
			uri: document.uri,
			error,
		});
	});

	it('handleDocumentChanged should report lint errors', async () => {
		const document = setDocument();
		const error = new Error('lint failed');

		options.setValidateLanguages(['css']);
		runner.setLintError(document.uri, error);

		await service.handleDocumentChanged(createChangeEvent(document));

		expect(connection.windowMessages).toHaveLength(1);
		expect(logger.error).toHaveBeenLastCalledWith('Error running lint', {
			uri: document.uri,
			error,
		});
	});

	it('handleDocumentClosed should clear diagnostics', async () => {
		const document = setDocument();

		diagnostics.setCachedDiagnostics(document.uri, [{ message: 'existing' } as LSP.Diagnostic]);

		await service.handleDocumentClosed(createChangeEvent(document));

		expect(diagnostics.clearCalls).toEqual([document.uri]);
		expect(connection.sendDiagnosticsCalls.at(-1)).toEqual({
			uri: document.uri,
			diagnostics: [],
		});
	});

	it('DidChangeWatchedFiles notification should revalidate all documents', async () => {
		const first = setDocument('a {}', 'css', 'file:///foo.css');
		const second = setDocument('b {}', 'css', 'file:///bar.css');
		const firstDiagnostics = [createDiagnostic('first')];
		const secondDiagnostics = [createDiagnostic('second')];

		options.setValidateLanguages(['css']);
		runner.setLintResult(first.uri, createDiagnosticsResult(firstDiagnostics));
		runner.setLintResult(second.uri, createDiagnosticsResult(secondDiagnostics));

		await invokeNotification(LSP.DidChangeWatchedFilesNotification.type);
		await flushPromises();

		expect(connection.sendDiagnosticsCalls).toEqual([
			{ uri: first.uri, diagnostics: firstDiagnostics },
			{ uri: second.uri, diagnostics: secondDiagnostics },
		]);
	});

	it('DidChangeConfiguration notification should revalidate all documents', async () => {
		const document = setDocument();
		const lintDiagnostics = [createDiagnostic('lint')];

		options.setValidateLanguages(['css']);
		runner.setLintResult(document.uri, createDiagnosticsResult(lintDiagnostics));

		await invokeNotification(LSP.DidChangeConfigurationNotification.type);
		await flushPromises();

		expect(connection.sendDiagnosticsCalls).toEqual([
			{ uri: document.uri, diagnostics: lintDiagnostics },
		]);
	});
});
