import { beforeEach, describe, expect, it } from 'vitest';
import type { Connection, TextDocumentChangeEvent } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

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
} from '../../../../../../../test/helpers/stubs/index.js';
import {
	createTestLogger,
	type TestLogger,
} from '../../../../../../../test/helpers/test-logger.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { getLanguageServerServiceMetadata } from '../../../decorators.js';
import type { LintDiagnostics } from '../../../stylelint/index.js';
import { lspConnectionToken, textDocumentsToken, UriModuleToken } from '../../../tokens.js';
import { CommandId } from '../../../types.js';
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
	setWorkspaceFolders(folders: Array<{ uri: string; name: string }>): void;
};

function createDiagnosticsConnectionStub(): DiagnosticsConnectionStub {
	const sendDiagnosticsCalls: DiagnosticsConnectionStub['sendDiagnosticsCalls'] = [];
	const windowMessages: string[] = [];
	let sendDiagnosticsError: unknown;
	let workspaceFolders: Array<{ uri: string; name: string }> = [];

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
		workspace: {
			getWorkspaceFolders: async () => workspaceFolders,
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
		setWorkspaceFolders: (folders: Array<{ uri: string; name: string }>) => {
			workspaceFolders = folders;
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
					provideTestValue(UriModuleToken, () => URI),
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

	it('onInitialize should validate all documents and return command capabilities', async () => {
		const first = setDocument('a {}', 'css', 'file:///foo.css');
		const second = setDocument('b {}', 'css', 'file:///bar.css');
		const firstDiagnostics = [createDiagnostic('first')];
		const secondDiagnostics = [createDiagnostic('second')];

		options.setValidateLanguages(['css']);
		runner.setLintResult(first.uri, createDiagnosticsResult(firstDiagnostics));
		runner.setLintResult(second.uri, createDiagnosticsResult(secondDiagnostics));

		const result = service.onInitialize();

		await flushPromises();

		expect(result).toEqual({
			capabilities: {
				executeCommandProvider: {
					commands: [CommandId.LintFiles, CommandId.ClearAllProblems],
				},
			},
		});
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

	describe('run mode', () => {
		it('handleDocumentOpened should always validate', async () => {
			const document = setDocument();
			const lintDiagnostics = [createDiagnostic('lint')];

			options.setValidateLanguages(['css']);
			options.setRunMode('onSave');
			runner.setLintResult(document.uri, createDiagnosticsResult(lintDiagnostics));

			await service.handleDocumentOpened(createChangeEvent(document));

			expect(connection.sendDiagnosticsCalls).toEqual([
				{ uri: document.uri, diagnostics: lintDiagnostics },
			]);
		});

		it('handleDocumentChanged should skip validation when run is onSave', async () => {
			const document = setDocument();

			options.setValidateLanguages(['css']);
			options.setRunMode('onSave');
			runner.setLintResult(document.uri, createDiagnosticsResult([createDiagnostic('lint')]));

			await service.handleDocumentChanged(createChangeEvent(document));

			expect(runner.lintCalls).toHaveLength(0);
		});

		it('handleDocumentChanged should validate when run is onType', async () => {
			const document = setDocument();
			const lintDiagnostics = [createDiagnostic('lint')];

			options.setValidateLanguages(['css']);
			options.setRunMode('onType');
			runner.setLintResult(document.uri, createDiagnosticsResult(lintDiagnostics));

			await service.handleDocumentChanged(createChangeEvent(document));

			expect(connection.sendDiagnosticsCalls).toEqual([
				{ uri: document.uri, diagnostics: lintDiagnostics },
			]);
		});

		it('handleDocumentSaved should validate when run is onSave', async () => {
			const document = setDocument();
			const lintDiagnostics = [createDiagnostic('lint')];

			options.setValidateLanguages(['css']);
			options.setRunMode('onSave');
			runner.setLintResult(document.uri, createDiagnosticsResult(lintDiagnostics));

			await service.handleDocumentSaved(createChangeEvent(document));

			expect(connection.sendDiagnosticsCalls).toEqual([
				{ uri: document.uri, diagnostics: lintDiagnostics },
			]);
		});

		it('handleDocumentSaved should skip validation when run is onType', async () => {
			const document = setDocument();

			options.setValidateLanguages(['css']);
			options.setRunMode('onType');
			runner.setLintResult(document.uri, createDiagnosticsResult([createDiagnostic('lint')]));

			await service.handleDocumentSaved(createChangeEvent(document));

			expect(runner.lintCalls).toHaveLength(0);
		});
	});

	describe('lintFiles', () => {
		it('should lint all workspace folders when no argument is provided', async () => {
			const lintDiagnostics = [createDiagnostic('error')];
			const multiResult = new Map([['/workspace/file.css', { diagnostics: lintDiagnostics }]]);

			runner.setLintWorkspaceFolderResult(multiResult);

			const folderUri = URI.file('/workspace').toString();

			connection.setWorkspaceFolders([{ uri: folderUri, name: 'workspace' }]);

			await service.lintFiles();

			expect(runner.lintWorkspaceFolderCalls).toHaveLength(1);
			expect(connection.sendDiagnosticsCalls).toHaveLength(1);
			expect(connection.sendDiagnosticsCalls[0].diagnostics).toEqual(lintDiagnostics);
		});

		it('should lint only the specified folder', async () => {
			const lintDiagnostics = [createDiagnostic('error')];
			const multiResult = new Map([['/specific/file.css', { diagnostics: lintDiagnostics }]]);

			runner.setLintWorkspaceFolderResult(multiResult);

			const folderUri = URI.file('/specific').toString();

			connection.setWorkspaceFolders([
				{ uri: URI.file('/workspace').toString(), name: 'workspace' },
				{ uri: folderUri, name: 'specific' },
			]);

			await service.lintFiles(folderUri);

			expect(runner.lintWorkspaceFolderCalls).toHaveLength(1);
			expect(connection.sendDiagnosticsCalls).toHaveLength(1);
		});

		it('should do nothing when no workspace folders exist', async () => {
			connection.setWorkspaceFolders([]);

			await service.lintFiles();

			expect(connection.sendDiagnosticsCalls).toHaveLength(0);
			expect(runner.lintWorkspaceFolderCalls).toHaveLength(0);
		});

		it('should cache lint results for open documents', async () => {
			const lintDiagnostics = [createDiagnostic('error')];
			const lintResult = { diagnostics: lintDiagnostics };
			const multiResult = new Map([['/workspace/file.css', lintResult]]);

			runner.setLintWorkspaceFolderResult(multiResult);

			const folderUri = URI.file('/workspace').toString();
			const fileUri = URI.file('/workspace/file.css').toString();

			setDocument('.a { color: red; }', 'css', fileUri);
			connection.setWorkspaceFolders([{ uri: folderUri, name: 'workspace' }]);

			await service.lintFiles();

			expect(diagnostics.setCalls).toHaveLength(1);
			expect(diagnostics.setCalls[0].document.uri).toBe(fileUri);
		});

		it('should pass the lintFiles.glob setting to the runner', async () => {
			const folderUri = URI.file('/workspace').toString();

			options.setOptions(folderUri, {
				lintFiles: { glob: '**/*.{css,scss}' },
			});

			runner.setLintWorkspaceFolderResult(new Map());
			connection.setWorkspaceFolders([{ uri: folderUri, name: 'workspace' }]);

			await service.lintFiles();

			expect(runner.lintWorkspaceFolderCalls).toHaveLength(1);
			expect(runner.lintWorkspaceFolderCalls[0].runnerOptions?.lintFilesGlob).toBe(
				'**/*.{css,scss}',
			);
		});
	});

	describe('clearAllProblems', () => {
		it('should clear diagnostics for open documents', async () => {
			const document = setDocument();
			const lintDiagnostics = [createDiagnostic('lint')];

			options.setValidateLanguages(['css']);
			runner.setLintResult(document.uri, createDiagnosticsResult(lintDiagnostics));

			await service.handleDocumentOpened(createChangeEvent(document));

			expect(connection.sendDiagnosticsCalls).toHaveLength(1);

			await service.clearAllProblems();

			expect(connection.sendDiagnosticsCalls).toHaveLength(2);
			expect(connection.sendDiagnosticsCalls[1]).toEqual({
				uri: document.uri,
				diagnostics: [],
			});
			expect(diagnostics.clearCalls).toEqual([document.uri]);
		});

		it('should clear diagnostics published by lintFiles', async () => {
			const lintDiagnostics = [createDiagnostic('error')];
			const multiResult = new Map([
				['/workspace/a.css', { diagnostics: lintDiagnostics }],
				['/workspace/b.css', { diagnostics: lintDiagnostics }],
			]);

			runner.setLintWorkspaceFolderResult(multiResult);

			const folderUri = URI.file('/workspace').toString();

			connection.setWorkspaceFolders([{ uri: folderUri, name: 'workspace' }]);

			await service.lintFiles();

			expect(connection.sendDiagnosticsCalls).toHaveLength(2);

			await service.clearAllProblems();

			// 2 from lintFiles + 2 clears.
			expect(connection.sendDiagnosticsCalls).toHaveLength(4);
			expect(connection.sendDiagnosticsCalls[2].diagnostics).toEqual([]);
			expect(connection.sendDiagnosticsCalls[3].diagnostics).toEqual([]);
		});

		it('should do nothing when no diagnostics exist', async () => {
			await service.clearAllProblems();

			expect(connection.sendDiagnosticsCalls).toHaveLength(0);
		});
	});
});
