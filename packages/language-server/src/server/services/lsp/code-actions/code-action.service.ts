import type { Connection, TextDocuments } from 'vscode-languageserver';
import * as LSP from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type winston from 'winston';

import { inject } from '../../../../di/index.js';
import { getEditInfo, RuleCodeActionsCollection } from '../../../utils/index.js';
import { codeActionRequest, command, initialize, lspService } from '../../../decorators.js';
import { isDisableReportRule } from '../../../stylelint/index.js';
import { lspConnectionToken, textDocumentsToken } from '../../../tokens.js';
import { CommandId, CodeActionKind as StylelintCodeActionKind } from '../../../types.js';
import { DocumentDiagnosticsService } from '../../documents/document-diagnostics.service.js';
import { DocumentFixesService } from '../../documents/document-fixes.service.js';
import { type LoggingService, loggingServiceToken } from '../../infrastructure/logging.service.js';
import { WorkspaceOptionsService } from '../../workspace/workspace-options.service.js';
import { DisableRuleFileCodeActionService } from './disable-rule-file-code-action.service.js';
import { DisableRuleLineCodeActionService } from './disable-rule-line-code-action.service.js';

@lspService()
@inject({
	inject: [
		textDocumentsToken,
		WorkspaceOptionsService,
		DocumentFixesService,
		DocumentDiagnosticsService,
		DisableRuleLineCodeActionService,
		DisableRuleFileCodeActionService,
		lspConnectionToken,
		loggingServiceToken,
	],
})
export class CodeActionService {
	#documents: TextDocuments<TextDocument>;
	#options: WorkspaceOptionsService;
	#fixes: DocumentFixesService;
	#diagnostics: DocumentDiagnosticsService;
	#disableRuleLineFactory: DisableRuleLineCodeActionService;
	#disableRuleFileFactory: DisableRuleFileCodeActionService;
	#connection: Connection;
	#logger?: winston.Logger;

	constructor(
		documents: TextDocuments<TextDocument>,
		options: WorkspaceOptionsService,
		fixes: DocumentFixesService,
		diagnostics: DocumentDiagnosticsService,
		disableRuleLineFactory: DisableRuleLineCodeActionService,
		disableRuleFileFactory: DisableRuleFileCodeActionService,
		connection: Connection,
		loggingService: LoggingService,
	) {
		this.#documents = documents;
		this.#options = options;
		this.#fixes = fixes;
		this.#diagnostics = diagnostics;
		this.#disableRuleLineFactory = disableRuleLineFactory;
		this.#disableRuleFileFactory = disableRuleFileFactory;
		this.#connection = connection;
		this.#logger = loggingService.createLogger(CodeActionService);
	}

	@initialize()
	onInitialize(): Partial<LSP.InitializeResult> {
		return {
			capabilities: {
				codeActionProvider: {
					codeActionKinds: [
						LSP.CodeActionKind.QuickFix,
						StylelintCodeActionKind.StylelintSourceFixAll,
					],
				},
				executeCommandProvider: {
					commands: [CommandId.OpenRuleDoc],
				},
			},
		};
	}

	@command(CommandId.OpenRuleDoc, { minArgs: 1 })
	async openRuleDocumentation(params: { uri: string } | undefined): Promise<object> {
		if (!params) {
			this.#logger?.debug('No URL provided, ignoring command request');

			return {};
		}

		const { uri } = params;

		this.#logger?.debug('Opening rule documentation', { uri });

		const response = await this.#connection.window.showDocument({ uri, external: true });

		if (!response.success) {
			this.#logger?.warn('Failed to open rule documentation', { uri });

			return new LSP.ResponseError(
				LSP.ErrorCodes.InternalError,
				'Failed to open rule documentation',
			);
		}

		return {};
	}

	@codeActionRequest()
	async handleCodeAction(
		params: LSP.CodeActionParams,
	): Promise<(LSP.Command | LSP.CodeAction)[] | undefined | null> {
		const { textDocument, context } = params;
		const { uri } = textDocument;

		this.#logger?.debug('Received onCodeAction', { uri, context });

		const document = this.#documents.get(uri);

		if (!document) {
			this.#logger?.debug('Unknown document, ignoring', { uri });

			return [];
		}

		if (!(await this.#shouldProvideCodeActions(document))) {
			this.#logger?.debug('Document should not be validated, ignoring', {
				uri,
				language: document.languageId,
			});

			return [];
		}

		const actions = await this.#getCodeActions(document, context);

		this.#logger?.debug('Returning code actions', { uri, count: actions.length });

		return actions;
	}

	async #shouldProvideCodeActions(document: TextDocument): Promise<boolean> {
		const options = await this.#options.getOptions(document.uri);

		return options.validate.includes(document.languageId);
	}

	async #getCodeActions(
		document: TextDocument,
		context: LSP.CodeActionContext,
	): Promise<LSP.CodeAction[]> {
		const only = context.only && new Set(context.only);
		const fixAllActions: LSP.CodeAction[] = [];

		if (
			only?.has(LSP.CodeActionKind.SourceFixAll) ||
			only?.has(StylelintCodeActionKind.StylelintSourceFixAll)
		) {
			this.#logger?.debug('Creating "source-fix-all" code action');

			const action = await this.#getAutoFixAllAction(document);

			if (action) {
				fixAllActions.push(action);
			}
		} else {
			this.#logger?.debug('No source-fix-all actions requested, skipping');
		}

		if (only?.has(LSP.CodeActionKind.Source)) {
			this.#logger?.debug('Creating "source" code action');
			fixAllActions.push(this.#getAutoFixAllCommandAction(document));
		} else {
			this.#logger?.debug('No source actions requested, skipping');
		}

		if (
			only &&
			!only.has(LSP.CodeActionKind.QuickFix) &&
			!only.has(LSP.CodeActionKind.SourceFixAll) &&
			!only.has(StylelintCodeActionKind.StylelintSourceFixAll) &&
			!only.has(LSP.CodeActionKind.Source)
		) {
			this.#logger?.debug('No quick fix actions requested, skipping quick fixes');

			return fixAllActions;
		}

		const result = new RuleCodeActionsCollection();

		for (const diagnostic of context.diagnostics) {
			const { source, code } = diagnostic;

			if (source !== 'Stylelint' || typeof code !== 'string') {
				continue;
			}

			if (!isDisableReportRule(code)) {
				const options = await this.#options.getOptions(document.uri);
				const { location } = options.codeAction.disableRuleComment;

				result.get(code).disableLine = this.#disableRuleLineFactory.create(
					document,
					diagnostic,
					location,
				);

				if (!result.get(code).disableFile) {
					result.get(code).disableFile = this.#disableRuleFileFactory.create(document, diagnostic);
				}
			}

			if (!result.get(code).documentation) {
				result.get(code).documentation = this.#getOpenRuleDocAction(diagnostic);
			}
		}

		this.#addFixAllForRuleActions(document, result);

		return [...this.#getQuickFixActions(document, context), ...result, ...fixAllActions];
	}

	async #getAutoFixAllAction(document: TextDocument): Promise<LSP.CodeAction | undefined> {
		const edits = await this.#fixes.getFixes(document);
		const identifier = { uri: document.uri, version: document.version };

		return edits.length > 0
			? LSP.CodeAction.create(
					'Fix all Stylelint auto-fixable problems',
					{ documentChanges: [LSP.TextDocumentEdit.create(identifier, edits)] },
					StylelintCodeActionKind.StylelintSourceFixAll,
				)
			: undefined;
	}

	#getAutoFixAllCommandAction(document: TextDocument): LSP.CodeAction {
		const lspCommand = LSP.Command.create(
			'Fix all Stylelint auto-fixable problems',
			CommandId.ApplyAutoFix,
			{ uri: document.uri, version: document.version },
		);

		return LSP.CodeAction.create(
			'Fix all Stylelint auto-fixable problems',
			lspCommand,
			LSP.CodeActionKind.Source,
		);
	}

	#getQuickFixActions(document: TextDocument, context: LSP.CodeActionContext): LSP.CodeAction[] {
		const identifier = { uri: document.uri, version: document.version };
		const actions: LSP.CodeAction[] = [];
		const lintResult = this.#diagnostics.getLintResult(document.uri);

		for (const diagnostic of context.diagnostics) {
			const editInfo = getEditInfo(document, diagnostic, lintResult);

			if (!editInfo) {
				continue;
			}

			const action = LSP.CodeAction.create(
				editInfo.label,
				{ documentChanges: [LSP.TextDocumentEdit.create(identifier, [editInfo.edit])] },
				LSP.CodeActionKind.QuickFix,
			);

			actions.push(action);
		}

		return actions;
	}

	#addFixAllForRuleActions(document: TextDocument, result: RuleCodeActionsCollection): void {
		const lintResult = this.#diagnostics.getLintResult(document.uri);

		if (!lintResult || document.version !== lintResult.version) {
			return;
		}

		const allDiagnostics = this.#diagnostics.getDiagnostics(document.uri);
		const editsByRule = new Map<
			string,
			{ edit: LSP.TextEdit; startOffset: number; endOffset: number }[]
		>();

		for (const diagnostic of allDiagnostics) {
			if (diagnostic.source !== 'Stylelint' || typeof diagnostic.code !== 'string') {
				continue;
			}

			const editInfo = getEditInfo(document, diagnostic, lintResult);

			if (!editInfo) {
				continue;
			}

			const startOffset = document.offsetAt(editInfo.edit.range.start);
			const endOffset = document.offsetAt(editInfo.edit.range.end);

			let edits = editsByRule.get(diagnostic.code);

			if (!edits) {
				edits = [];
				editsByRule.set(diagnostic.code, edits);
			}

			edits.push({ edit: editInfo.edit, startOffset, endOffset });
		}

		const identifier = { uri: document.uri, version: document.version };

		for (const [rule, edits] of editsByRule) {
			if (edits.length < 2) {
				continue;
			}

			// Sort by start offset and filter out overlapping edits.
			edits.sort((a, b) => a.startOffset - b.startOffset);

			const nonOverlapping: LSP.TextEdit[] = [];
			let lastEnd = -1;

			for (const entry of edits) {
				if (entry.startOffset >= lastEnd) {
					nonOverlapping.push(entry.edit);
					lastEnd = entry.endOffset;
				}
			}

			if (nonOverlapping.length < 2) {
				continue;
			}

			result.get(rule).fixAll = LSP.CodeAction.create(
				`Fix all ${rule} problems`,
				{ documentChanges: [LSP.TextDocumentEdit.create(identifier, nonOverlapping)] },
				LSP.CodeActionKind.QuickFix,
			);
		}
	}

	#getOpenRuleDocAction({ code, codeDescription }: LSP.Diagnostic): LSP.CodeAction | undefined {
		const uri = codeDescription?.href;

		if (!uri) {
			return undefined;
		}

		const lspCommand = LSP.Command.create(`Open documentation for ${code}`, CommandId.OpenRuleDoc, {
			uri,
		});

		return LSP.CodeAction.create(
			`Show documentation for ${code}`,
			lspCommand,
			LSP.CodeActionKind.QuickFix,
		);
	}
}
