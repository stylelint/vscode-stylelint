import { beforeEach, describe, expect, it } from 'vitest';
import type { Connection } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, Range } from 'vscode-languageserver-types';

import {
	createDocumentDiagnosticsServiceStub,
	createLoggingServiceStub,
	createTextDocumentsStore,
	createWorkspaceOptionsStub,
	type DocumentDiagnosticsServiceStub,
	type TextDocumentsStore,
	type WorkspaceOptionsServiceStub,
} from '../../../../../test/helpers/stubs/index.js';
import { createTestLogger, type TestLogger } from '../../../../../test/helpers/test-logger.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { DisableReportRuleNames } from '../../../stylelint/index.js';
import { lspConnectionToken, textDocumentsToken } from '../../../tokens.js';
import { DocumentDiagnosticsService } from '../../documents/document-diagnostics.service.js';
import { type LoggingService, loggingServiceToken } from '../../infrastructure/logging.service.js';
import { NotificationService } from '../../infrastructure/notification.service.js';
import { WorkspaceOptionsService } from '../../workspace/workspace-options.service.js';
import { CompletionService } from '../completion.service.js';

function createParams(overrides: Partial<LSP.CompletionParams> = {}): LSP.CompletionParams {
	return {
		textDocument: overrides.textDocument ?? { uri: 'foo' },
		position: overrides.position ?? Position.create(0, 0),
	};
}

function createNeedlessDisableDiagnostic({
	rule,
	range,
}: {
	rule: string;
	range: LSP.Range;
}): LSP.Diagnostic {
	return {
		message: `Needless disable for "${rule}"`,
		range,
		code: DisableReportRuleNames.Needless,
	};
}

describe('CompletionService', () => {
	let service: CompletionService;
	let documents: TextDocumentsStore;
	let options: WorkspaceOptionsServiceStub;
	let diagnostics: DocumentDiagnosticsServiceStub;
	let connection: Connection;
	let logger: TestLogger;
	let loggingService: LoggingService;

	const createConnection = (): Connection =>
		({
			onCompletion: () => ({ dispose() {} }) as LSP.Disposable,
			onNotification: () => ({ dispose() {} }) as LSP.Disposable,
		}) as unknown as Connection;

	const setDocument = (content = 'a {}', languageId = 'css', uri = 'foo'): TextDocument => {
		const document = TextDocument.create(uri, languageId, 1, content);

		documents.set(document);

		return document;
	};

	const requestCompletions = (params: LSP.CompletionParams) => service.handleCompletion(params);

	beforeEach(() => {
		documents = createTextDocumentsStore();
		options = createWorkspaceOptionsStub();
		diagnostics = createDocumentDiagnosticsServiceStub();
		connection = createConnection();
		logger = createTestLogger();
		loggingService = createLoggingServiceStub(logger);

		const container = createContainer(
			module({
				register: [
					provideTestValue(textDocumentsToken, () => documents),
					provideTestValue(WorkspaceOptionsService, () => options),
					provideTestValue(DocumentDiagnosticsService, () => diagnostics),
					provideTestValue(lspConnectionToken, () => connection),
					provideTestValue(loggingServiceToken, () => loggingService),
					NotificationService,
					CompletionService,
				],
			}),
		);

		service = container.resolve(CompletionService);
	});

	it('should be constructable', () => {
		expect(service).toBeInstanceOf(CompletionService);
	});

	it('onInitialize should return capabilities', () => {
		expect(service.onInitialize?.()).toMatchSnapshot();
	});

	it('if no matching document exists, should not return completions', async () => {
		const result = await requestCompletions(createParams());

		expect(result).toStrictEqual([]);
		expect(logger.debug).toHaveBeenLastCalledWith('Unknown document, ignoring', {
			uri: 'foo',
		});
	});

	it('if document language ID is not in validate options, should not return completions', async () => {
		const document = setDocument('a {}', 'bar', 'foo');

		options.setValidateLanguages(['baz']);
		options.setSnippetLanguages([document.languageId]);

		const result = await requestCompletions(createParams({ textDocument: { uri: document.uri } }));

		expect(result).toStrictEqual([]);
		expect(logger.debug).toHaveBeenLastCalledWith(
			'Snippets or validation not enabled for language, ignoring',
			{ uri: document.uri, language: document.languageId },
		);
	});

	it('if document language ID is not in snippet options, should not return completions', async () => {
		const document = setDocument('a {}', 'bar', 'foo');

		options.setValidateLanguages([document.languageId]);
		options.setSnippetLanguages(['baz']);

		const result = await requestCompletions(createParams({ textDocument: { uri: document.uri } }));

		expect(result).toStrictEqual([]);
		expect(logger.debug).toHaveBeenLastCalledWith(
			'Snippets or validation not enabled for language, ignoring',
			{ uri: document.uri, language: document.languageId },
		);
	});

	it('with no debug log level and no valid document, should not attempt to log reason', async () => {
		const document = setDocument('a {}', 'bar', 'foo');

		options.setValidateLanguages([document.languageId]);
		options.setSnippetLanguages(['baz']);
		logger.setDebugEnabled(false);

		const result = await requestCompletions(createParams({ textDocument: { uri: document.uri } }));

		expect(result).toStrictEqual([]);
		const debugCalls = logger.debug.mock.calls as unknown as Array<[string, unknown?]>;
		const lastDebugCall = debugCalls.at(-1);

		expect(lastDebugCall).toEqual([
			'Received onCompletion',
			{ uri: document.uri, position: Position.create(0, 0) },
		]);
		expect(
			debugCalls.some(
				([message]) => message === 'Snippets or validation not enabled for language, ignoring',
			),
		).toBe(false);
	});

	it('without diagnostics, should return generic completions', async () => {
		const document = setDocument('a {}', 'css', 'foo');

		options.setValidateLanguages([document.languageId]);
		options.setSnippetLanguages([document.languageId]);

		const result = await requestCompletions(createParams({ textDocument: { uri: document.uri } }));

		expect(result).toMatchSnapshot();
	});

	it('with no diagnostics at the same or next line, should return generic completions', async () => {
		const document = setDocument('a {\n  color: red;\n}\n', 'css', 'foo');

		options.setValidateLanguages([document.languageId]);
		options.setSnippetLanguages([document.languageId]);
		diagnostics.setDiagnostics(document.uri, [
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(3, 4, 3, 4),
			},
			{
				code: 5 as unknown as string,
				message: 'Not a Stylelint diagnostic',
				range: Range.create(1, 2, 1, 4),
			},
		]);

		const result = await requestCompletions(
			createParams({
				textDocument: { uri: document.uri },
				position: Position.create(1, 3),
			}),
		);

		expect(result).toMatchSnapshot();
	});

	it('with diagnostics at the same line, should return disable comment completions for rule', async () => {
		const document = setDocument('a {\n  color: red;\n}', 'css', 'foo');

		options.setValidateLanguages([document.languageId]);
		options.setSnippetLanguages([document.languageId]);
		diagnostics.setDiagnostics(document.uri, [
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(1, 2, 3, 4),
			},
		]);

		const result = await requestCompletions(
			createParams({
				textDocument: { uri: document.uri },
				position: Position.create(1, 3),
			}),
		);

		expect(result).toMatchSnapshot();
	});

	it('with diagnostics at the next line, should return disable comment completions for rule', async () => {
		const document = setDocument('a {\n  font-weight: 400;\n  color: red;\n}', 'css', 'foo');

		options.setValidateLanguages([document.languageId]);
		options.setSnippetLanguages([document.languageId]);
		diagnostics.setDiagnostics(document.uri, [
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(2, 1, 3, 4),
			},
		]);

		const result = await requestCompletions(
			createParams({
				textDocument: { uri: document.uri },
				position: Position.create(1, 3),
			}),
		);

		expect(result).toMatchSnapshot();
	});

	it('with needless disables reported for a diagnostic, should return generic completions', async () => {
		const document = setDocument('a {\n  color: red;\n}', 'css', 'foo');

		options.setValidateLanguages([document.languageId]);
		options.setSnippetLanguages([document.languageId]);
		diagnostics.setDiagnostics(document.uri, [
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(1, 2, 3, 4),
			},
			createNeedlessDisableDiagnostic({
				rule: 'indentation',
				range: Range.create(1, 2, 3, 4),
			}),
		]);

		const result = await requestCompletions(
			createParams({
				textDocument: { uri: document.uri },
				position: Position.create(1, 3),
			}),
		);

		expect(result).toMatchSnapshot();
	});

	it('with diagnostics at the same line and cursor in a line disable comment, should return rule completions', async () => {
		const document = setDocument(
			'a {\n  /* stylelint-disable-line  */\n  color: red;\n}',
			'css',
			'foo',
		);

		options.setValidateLanguages([document.languageId]);
		options.setSnippetLanguages([document.languageId]);
		diagnostics.setDiagnostics(document.uri, [
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(1, 2, 3, 4),
			},
		]);

		const result = await requestCompletions(
			createParams({
				textDocument: { uri: document.uri },
				position: Position.create(1, 28),
			}),
		);

		expect(result).toMatchSnapshot();
	});

	it('with diagnostics at the next line and cursor in a next-line disable comment, should return rule completions', async () => {
		const document = setDocument(
			'a {\n  /* stylelint-disable-next-line  */\n  color: red;\n}',
			'css',
			'foo',
		);

		options.setValidateLanguages([document.languageId]);
		options.setSnippetLanguages([document.languageId]);
		diagnostics.setDiagnostics(document.uri, [
			{
				code: 'indentation',
				message: 'Expected indentation of 4 spaces',
				range: Range.create(2, 2, 3, 4),
			},
		]);

		const result = await requestCompletions(
			createParams({
				textDocument: { uri: document.uri },
				position: Position.create(1, 33),
			}),
		);

		expect(result).toMatchSnapshot();
	});
});
