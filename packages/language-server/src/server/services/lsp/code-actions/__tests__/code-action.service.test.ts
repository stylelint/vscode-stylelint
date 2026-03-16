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
} from '../../../../../../../../test/helpers/stubs/index.js';
import {
	createTestLogger,
	type TestLogger,
} from '../../../../../../../../test/helpers/test-logger.js';
import { createContainer, module, provideTestValue } from '../../../../../di/index.js';
import { lspConnectionToken, OsModuleToken, textDocumentsToken } from '../../../../tokens.js';
import { CodeActionKind as StylelintCodeActionKind } from '../../../../types.js';
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
	windowShowDocumentCalls: LSP.ShowDocumentParams[];
	setShowDocumentResponder(
		responder: (
			params: LSP.ShowDocumentParams,
		) => LSP.ShowDocumentResult | Promise<LSP.ShowDocumentResult>,
	): void;
};

function createCodeActionConnectionStub(): CodeActionConnectionStub {
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
		onCodeAction: () => ({ dispose() {} }) as LSP.Disposable,
		onNotification: () => ({ dispose() {} }) as LSP.Disposable,
	} as unknown as Connection;

	return {
		connection,
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

	/**
	 * Sets up fixable warnings and diagnostics, then requests code actions.
	 * Diagnostic ranges are derived from fix ranges on line 0.
	 */
	async function requestWithFixes(
		content: string,
		fixDefs: Array<{ rule: string; range: [number, number]; text: string }>,
		contextIndices?: number[],
	) {
		const document = setDocument(content);

		options.setValidateLanguages([document.languageId]);

		const warnings = fixDefs.map((def, i) => ({
			rule: def.rule,
			line: 1,
			column: def.range[0] + 1,
			text: `problem ${i + 1}`,
			severity: 'error' as const,
			fix: { range: def.range, text: def.text },
		}));

		const allDiagnostics: LSP.Diagnostic[] = fixDefs.map((def, i) => ({
			message: `problem ${i + 1}`,
			source: 'Stylelint',
			range: LSP.Range.create(0, def.range[0], 0, def.range[1]),
			code: def.rule,
			severity: LSP.DiagnosticSeverity.Error,
		}));

		const warningMap = new Map<string, (typeof warnings)[number]>();

		for (const [i, d] of allDiagnostics.entries()) {
			warningMap.set(
				`${d.range.start.line}:${d.range.start.character}:${d.range.end.line}:${d.range.end.character}`,
				warnings[i],
			);
		}

		diagnostics.setDiagnostics(document.uri, allDiagnostics);
		diagnostics.setLintResult(document.uri, {
			diagnostics: allDiagnostics,
			version: document.version,
			getWarning: (d: LSP.Diagnostic) => {
				const key = `${d.range.start.line}:${d.range.start.character}:${d.range.end.line}:${d.range.end.character}`;

				return warningMap.get(key) ?? null;
			},
		});

		const indices = contextIndices ?? Array.from({ length: fixDefs.length }, (_, i) => i);

		return requestCodeActions(
			createParams({
				context: { diagnostics: indices.map((i) => allDiagnostics[i]) },
				textDocument: { uri: document.uri },
			}),
		);
	}

	function findFixAllAction(
		result: (LSP.Command | LSP.CodeAction)[] | null | undefined,
		rule: string,
	) {
		return result?.find(
			(a): a is LSP.CodeAction => 'title' in a && a.title === `Fix all ${rule} problems`,
		);
	}

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

	describe('fix all per rule', () => {
		it('should create fix-all action when a rule has 2+ fixable diagnostics', async () => {
			const result = await requestWithFixes(
				'aa bb cc',
				[
					{ rule: 'test-rule', range: [0, 2], text: 'AA' },
					{ rule: 'test-rule', range: [3, 5], text: 'BB' },
				],
				[0],
			);

			const action = findFixAllAction(result, 'test-rule');

			expect(action).toBeDefined();
			expect(action).toHaveProperty('kind', LSP.CodeActionKind.QuickFix);
			expect(action?.edit?.documentChanges).toHaveLength(1);

			const textDocEdit = action?.edit?.documentChanges?.[0] as LSP.TextDocumentEdit;

			expect(textDocEdit.edits).toHaveLength(2);
		});

		it('should not create fix-all action when a rule has only 1 fixable diagnostic', async () => {
			const result = await requestWithFixes('aa bb', [
				{ rule: 'test-rule', range: [0, 2], text: 'AA' },
			]);

			expect(findFixAllAction(result, 'test-rule')).toBeUndefined();
		});

		it('should exclude overlapping edits from fix-all action', async () => {
			const result = await requestWithFixes(
				'aabb cc', // cspell:disable-line
				[
					{ rule: 'test-rule', range: [0, 3], text: 'AA' },
					{ rule: 'test-rule', range: [2, 4], text: 'BB' }, // overlaps first
					{ rule: 'test-rule', range: [5, 7], text: 'CC' },
				],
				[0],
			);

			const action = findFixAllAction(result, 'test-rule');

			expect(action).toBeDefined();

			// Should only include warning 1 (0-3) and 3 (5-7), skipping warning
			// 2 (2-4) which overlaps.
			const textDocEdit = action?.edit?.documentChanges?.[0] as LSP.TextDocumentEdit;

			expect(textDocEdit.edits).toHaveLength(2);
			expect(textDocEdit.edits[0]).toMatchObject({ newText: 'AA' });
			expect(textDocEdit.edits[1]).toMatchObject({ newText: 'CC' });
		});

		it('should not create fix-all action when all overlapping edits reduce count below 2', async () => {
			const result = await requestWithFixes(
				'aabb', // cspell:disable-line
				[
					{ rule: 'test-rule', range: [0, 3], text: 'AA' },
					{ rule: 'test-rule', range: [2, 4], text: 'BB' }, // overlaps
				],
			);

			expect(findFixAllAction(result, 'test-rule')).toBeUndefined();
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
