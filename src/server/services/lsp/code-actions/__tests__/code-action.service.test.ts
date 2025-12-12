import os from 'os';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Disposable } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

import {
	createDocumentDiagnosticsServiceStub,
	createDocumentFixesServiceStub,
	createLoggingServiceStub,
	createTextDocumentsStore,
	createWorkspaceOptionsStub,
	type DocumentDiagnosticsServiceStub,
	type DocumentFixesServiceStub,
	type TextDocumentsStore,
	type WorkspaceOptionsServiceStub,
} from '../../../../../../test/helpers/stubs/index.js';
import { createTestLogger, type TestLogger } from '../../../../../../test/helpers/test-logger.js';
import { createContainer, module, provideTestValue } from '../../../../../di/index.js';
import { lspConnectionToken, OsModuleToken, textDocumentsToken } from '../../../../tokens.js';
import { Notification, CodeActionKind as StylelintCodeActionKind } from '../../../../types.js';
import { DocumentDiagnosticsService, DocumentFixesService } from '../../../documents/index.js';
import {
	type LoggingService,
	loggingServiceToken,
} from '../../../infrastructure/logging.service.js';
import { NotificationService } from '../../../infrastructure/notification.service.js';
import { WorkspaceOptionsService } from '../../../workspace/workspace-options.service.js';
import { CodeActionService } from '../code-action.service.js';
import { DisableRuleFileCodeActionService } from '../disable-rule-file-code-action.service.js';
import { DisableRuleLineCodeActionService } from '../disable-rule-line-code-action.service.js';

const defaultRange = LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0));

type CodeActionConnectionStub = {
	connection: Connection;
	sendNotificationCalls: Array<{
		method: string | LSP.ProtocolNotificationType<unknown, unknown>;
		params: unknown;
	}>;
	windowShowDocumentCalls: LSP.ShowDocumentParams[];
	setShowDocumentResponder(
		responder: (
			params: LSP.ShowDocumentParams,
		) => LSP.ShowDocumentResult | Promise<LSP.ShowDocumentResult>,
	): void;
};

function createCodeActionConnectionStub(): CodeActionConnectionStub {
	const sendNotificationCalls: CodeActionConnectionStub['sendNotificationCalls'] = [];
	const windowShowDocumentCalls: LSP.ShowDocumentParams[] = [];
	let showDocumentResponder: (
		params: LSP.ShowDocumentParams,
	) => LSP.ShowDocumentResult | Promise<LSP.ShowDocumentResult> = async () => ({
		success: true,
	});

	const connection = {
		client: {
			register: async () => ({}) as Disposable,
		},
		window: {
			showDocument: async (params: LSP.ShowDocumentParams) => {
				windowShowDocumentCalls.push(params);

				return showDocumentResponder(params);
			},
		},
		sendNotification: async (
			method: string | LSP.ProtocolNotificationType<unknown, unknown>,
			params?: unknown,
		) => {
			sendNotificationCalls.push({ method, params });
		},
		onCodeAction: () => ({ dispose() {} }) as LSP.Disposable,
		onNotification: () => ({ dispose() {} }) as LSP.Disposable,
	} as unknown as Connection;

	return {
		connection,
		sendNotificationCalls,
		windowShowDocumentCalls,
		setShowDocumentResponder: (responder) => {
			showDocumentResponder = responder;
		},
	};
}

function createParams(overrides: Partial<LSP.CodeActionParams> = {}): LSP.CodeActionParams {
	return {
		context: overrides.context ?? { diagnostics: [] },
		range: overrides.range ?? defaultRange,
		textDocument: overrides.textDocument ?? { uri: 'foo' },
	};
}

describe('CodeActionService', () => {
	let service: CodeActionService;
	let documents: TextDocumentsStore;
	let options: WorkspaceOptionsServiceStub;
	let fixes: DocumentFixesServiceStub;
	let diagnostics: DocumentDiagnosticsServiceStub;
	let connection: CodeActionConnectionStub;
	let logger: TestLogger;
	let loggingService: LoggingService;

	const setDocument = (
		content = 'line 1\nline 2',
		languageId = 'css',
		uri = 'foo',
	): TextDocument => {
		const document = TextDocument.create(uri, languageId, 1, content);

		documents.set(document);

		return document;
	};

	const requestCodeActions = (params: LSP.CodeActionParams) => service.handleCodeAction(params);

	beforeEach(() => {
		documents = createTextDocumentsStore();
		options = createWorkspaceOptionsStub();
		fixes = createDocumentFixesServiceStub();
		diagnostics = createDocumentDiagnosticsServiceStub();
		connection = createCodeActionConnectionStub();
		logger = createTestLogger();
		loggingService = createLoggingServiceStub(logger);

		const container = createContainer(
			module({
				register: [
					provideTestValue(textDocumentsToken, () => documents),
					provideTestValue(WorkspaceOptionsService, () => options),
					provideTestValue(DocumentFixesService, () => fixes),
					provideTestValue(DocumentDiagnosticsService, () => diagnostics),
					provideTestValue(OsModuleToken, () => os),
					provideTestValue(lspConnectionToken, () => connection.connection),
					provideTestValue(loggingServiceToken, () => loggingService),
					NotificationService,
					DisableRuleLineCodeActionService,
					DisableRuleFileCodeActionService,
					CodeActionService,
				],
			}),
		);

		service = container.resolve(CodeActionService);
	});

	it('should be constructable', () => {
		expect(service).toBeInstanceOf(CodeActionService);
	});

	it('onInitialize should return capabilities', () => {
		expect(service.onInitialize?.()).toMatchSnapshot();
	});

	it('handleInitialized should send DidRegister notification', async () => {
		service.onInitialized();

		expect(connection.sendNotificationCalls).toEqual([
			{
				method: Notification.DidRegisterCodeActionRequestHandler,
				params: undefined,
			},
		]);
	});

	it('with action kind Source, should create fix-all command actions', async () => {
		const document = setDocument();

		options.setValidateLanguages([document.languageId]);

		const result = await requestCodeActions(
			createParams({
				context: { only: [LSP.CodeActionKind.Source], diagnostics: [] },
				textDocument: { uri: document.uri },
			}),
		);

		expect(result).toMatchSnapshot();
		expect(fixes.calls).toHaveLength(0);
	});

	it('with action kind StylelintSourceFixAll, should create fix-all workspace edits', async () => {
		const document = setDocument();

		options.setValidateLanguages([document.languageId]);
		fixes.setFixes(document.uri, [LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);

		const result = await requestCodeActions(
			createParams({
				context: { only: [StylelintCodeActionKind.StylelintSourceFixAll], diagnostics: [] },
				textDocument: { uri: document.uri },
			}),
		);

		expect(result).toMatchSnapshot();
		expect(fixes.calls.map((call) => call.document.uri)).toEqual([document.uri]);
	});

	it('with action kind SourceFixAll, should create fix-all workspace edits', async () => {
		const document = setDocument();

		options.setValidateLanguages([document.languageId]);
		fixes.setFixes(document.uri, [LSP.TextEdit.insert(LSP.Position.create(0, 0), 'text')]);

		const result = await requestCodeActions(
			createParams({
				context: { only: [LSP.CodeActionKind.SourceFixAll], diagnostics: [] },
				textDocument: { uri: document.uri },
			}),
		);

		expect(result).toMatchSnapshot();
		expect(fixes.calls.map((call) => call.document.uri)).toEqual([document.uri]);
	});

	it('with action kind SourceFixAll but no fixes, should not create fix-all actions', async () => {
		const document = setDocument();

		options.setValidateLanguages([document.languageId]);
		fixes.setFixes(document.uri, []);

		const result = await requestCodeActions(
			createParams({
				context: { only: [LSP.CodeActionKind.SourceFixAll], diagnostics: [] },
				textDocument: { uri: document.uri },
			}),
		);

		expect(result).toStrictEqual([]);
		expect(fixes.calls.map((call) => call.document.uri)).toEqual([document.uri]);
	});

	it('with no action kind, should create actions for Stylelint diagnostics', async () => {
		const document = setDocument('line 1\nline 2');

		options.setValidateLanguages([document.languageId]);

		const stylelintDiagnostics: LSP.Diagnostic[] = [
			{
				message: 'Message for rule 1',
				source: 'Stylelint',
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
				code: 'rule-1',
				severity: LSP.DiagnosticSeverity.Error,
				codeDescription: { href: 'https://stylelint.io/user-guide/rules/rule' },
			},
			{
				message: 'Message for rule 2',
				source: 'ESLint',
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
				code: 'rule-2',
				severity: LSP.DiagnosticSeverity.Warning,
			},
			{
				message: 'Message for rule 3',
				source: 'Stylelint',
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 0)),
				code: 'rule-3',
				severity: LSP.DiagnosticSeverity.Warning,
			},
			{
				message: 'Message for rule 4',
				source: 'Stylelint',
				range: LSP.Range.create(LSP.Position.create(0, 1), LSP.Position.create(0, 1)),
				code: 'rule-1',
				severity: LSP.DiagnosticSeverity.Error,
				codeDescription: { href: 'https://stylelint.io/user-guide/rules/rule' },
			},
		];

		diagnostics.setDiagnostics(document.uri, stylelintDiagnostics);

		const result = await requestCodeActions(
			createParams({
				context: { diagnostics: stylelintDiagnostics },
				textDocument: { uri: document.uri },
				range: LSP.Range.create(LSP.Position.create(0, 0), LSP.Position.create(0, 1)),
			}),
		);

		expect(result).toMatchSnapshot();
		expect(fixes.calls).toHaveLength(0);
		expect(logger.debug).toHaveBeenLastCalledWith('Returning code actions', {
			uri: document.uri,
			count: result?.length ?? 0,
		});
	});

	it('with unsupported action kind, should not create actions', async () => {
		const document = setDocument();

		options.setValidateLanguages([document.languageId]);

		const result = await requestCodeActions(
			createParams({
				context: { only: ['foo'], diagnostics: [] },
				textDocument: { uri: document.uri },
			}),
		);

		expect(result).toStrictEqual([]);
		const debugCalls = logger.debug.mock.calls as unknown as Array<[string, unknown]>;
		const debugMessages = debugCalls.map(([message]) => message);

		expect(debugMessages).toEqual(
			expect.arrayContaining([
				'No source-fix-all actions requested, skipping',
				'No source actions requested, skipping',
				'No quick fix actions requested, skipping quick fixes',
				'Returning code actions',
			]),
		);
	});

	it('if no matching document exists, should not attempt to create actions', async () => {
		const result = await requestCodeActions(
			createParams({
				context: { only: [LSP.CodeActionKind.Source], diagnostics: [] },
				textDocument: { uri: 'foo' },
			}),
		);

		expect(result).toStrictEqual([]);
		expect(logger.debug).toHaveBeenLastCalledWith('Unknown document, ignoring', {
			uri: 'foo',
		});
	});

	it('if document language is not validated, should not attempt to create actions', async () => {
		const document = setDocument();

		options.setValidateLanguages(['baz']);

		const result = await requestCodeActions(
			createParams({
				context: { only: [LSP.CodeActionKind.Source], diagnostics: [] },
				textDocument: { uri: document.uri },
			}),
		);

		expect(result).toStrictEqual([]);
		expect(logger.debug).toHaveBeenLastCalledWith('Document should not be validated, ignoring', {
			uri: document.uri,
			language: document.languageId,
		});
	});

	describe('OpenRuleDoc command', () => {
		it('should open the rule documentation URL', async () => {
			setDocument();

			const result = await service.openRuleDocumentation({
				uri: 'https://stylelint.io/user-guide/rules/foo',
			});

			expect(result).toStrictEqual({});
			expect(connection.windowShowDocumentCalls).toEqual([
				{
					uri: 'https://stylelint.io/user-guide/rules/foo',
					external: true,
				},
			]);
			expect(logger.debug).toHaveBeenLastCalledWith('Opening rule documentation', {
				uri: 'https://stylelint.io/user-guide/rules/foo',
			});
		});

		it('if no URL is provided, should do nothing', async () => {
			const result = await service.openRuleDocumentation(undefined);

			expect(result).toStrictEqual({});
			expect(connection.windowShowDocumentCalls).toHaveLength(0);
			expect(logger.debug).toHaveBeenLastCalledWith('No URL provided, ignoring command request');
		});

		it('if opening the URL fails, should warn and respond with error', async () => {
			connection.setShowDocumentResponder(async () => ({ success: false }));

			const result = await service.openRuleDocumentation({
				uri: 'https://stylelint.io/user-guide/rules/foo',
			});

			expect(result).toBeInstanceOf(LSP.ResponseError);
			expect(logger.warn).toHaveBeenLastCalledWith('Failed to open rule documentation', {
				uri: 'https://stylelint.io/user-guide/rules/foo',
			});
		});
	});
});
