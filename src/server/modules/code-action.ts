import os from 'os';
import {
	CodeActionKind,
	CodeAction,
	TextDocumentEdit,
	Command,
	WorkspaceChange,
	uinteger,
	Position,
	TextEdit,
	Range,
} from 'vscode-languageserver-types';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type LSP from 'vscode-languageserver-protocol';
import type winston from 'winston';
import { CodeActionKind as StylelintCodeActionKind, CommandId } from '../types';
import { RuleCodeActionsCollection } from '../../utils/lsp';
import { DisableReportRuleNames } from '../../utils/stylelint';
import type {
	LanguageServerContext,
	LanguageServerModuleConstructorParameters,
	LanguageServerModule,
} from '../types';

export class CodeActionModule implements LanguageServerModule {
	static id = 'code-action';

	/**
	 * The language server context.
	 */
	#context: LanguageServerContext;

	/**
	 * The logger to use, if any.
	 */
	#logger: winston.Logger | undefined;

	constructor({ context, logger }: LanguageServerModuleConstructorParameters) {
		this.#context = context;
		this.#logger = logger;
	}

	async #shouldCodeAction(document: TextDocument): Promise<boolean> {
		const options = await this.#context.getOptions(document.uri);

		return options.validate.includes(document.languageId);
	}

	onInitialize(): Partial<LSP.InitializeResult> {
		return {
			capabilities: {
				codeActionProvider: {
					codeActionKinds: [CodeActionKind.QuickFix, StylelintCodeActionKind.StylelintSourceFixAll],
				},
				executeCommandProvider: {
					commands: [CommandId.OpenRuleDoc],
				},
			},
		};
	}

	onDidRegisterHandlers(): void {
		this.#logger?.debug('Registering onCodeAction handler');

		this.#context.connection.onCodeAction(async ({ context, textDocument }) => {
			this.#logger?.debug('Received onCodeAction', { context, uri: textDocument.uri });

			const uri = textDocument.uri;
			const document = this.#context.documents.get(uri);

			if (!document) {
				this.#logger?.debug('Unknown document, ignoring', { uri });

				return [];
			}

			if (!(await this.#shouldCodeAction(document))) {
				this.#logger?.debug('Document should not be validated, ignoring', {
					uri,
					language: document.languageId,
				});

				return [];
			}

			const actions = await this.#getCodeActions(document, context);

			this.#logger?.debug('Returning code actions', { actions });

			return actions;
		});

		this.#logger?.debug('onCodeAction handler registered');

		this.#context.commands.on(CommandId.OpenRuleDoc, async ({ arguments: args }) => {
			const params: { uri: string } | undefined = args?.[0];

			if (!params) {
				return {};
			}

			const { uri } = params;

			// Open URL in browser
			const showURIResponse = await this.#context.connection.window.showDocument({
				uri,
				external: true,
			});

			if (!showURIResponse.success) {
				this.#logger?.warn('Failed to open documentation for rule', { uri });
			}
		});
	}

	async #getAutoFixAllAction(document: TextDocument): Promise<CodeAction | undefined> {
		const edits = await this.#context.getFixes(document);

		return edits.length > 0
			? CodeAction.create(
					'Fix all Stylelint auto-fixable problems',
					{ documentChanges: [TextDocumentEdit.create(document, edits)] },
					CodeActionKind.SourceFixAll,
			  )
			: undefined;
	}

	#getAutoFixAllCommandAction(document: TextDocument): CodeAction | undefined {
		const command = Command.create(
			'Fix all Stylelint auto-fixable problems',
			CommandId.ApplyAutoFix,
			{ uri: document.uri, version: document.version },
		);

		return CodeAction.create(
			'Fix all Stylelint auto-fixable problems',
			command,
			CodeActionKind.Source,
		);
	}

	#getDisableRuleLineAction(
		document: TextDocument,
		{ code, range }: LSP.Diagnostic,
		location: 'sameLine' | 'separateLine',
	): CodeAction {
		const workspaceChange = new WorkspaceChange();

		if (location === 'sameLine') {
			workspaceChange
				.getTextEditChange(document)
				.add(
					TextEdit.insert(
						Position.create(range.start.line, uinteger.MAX_VALUE),
						` /* stylelint-disable-line ${code} */`,
					),
				);
		} else {
			const lineText = document.getText(
				Range.create(
					Position.create(range.start.line, 0),
					Position.create(range.start.line, uinteger.MAX_VALUE),
				),
			);
			const indentation = lineText.match(/^([ \t]*)/)?.[1] ?? '';

			workspaceChange
				.getTextEditChange(document)
				.add(
					TextEdit.insert(
						Position.create(range.start.line, 0),
						`${indentation}/* stylelint-disable-next-line ${code} */${os.EOL}`,
					),
				);
		}

		return CodeAction.create(
			`Disable ${code} for this line`,
			workspaceChange.edit,
			CodeActionKind.QuickFix,
		);
	}

	#getDisableRuleFileAction(document: TextDocument, { code }: LSP.Diagnostic): CodeAction {
		const workspaceChange = new WorkspaceChange();

		const shebang = document?.getText(Range.create(Position.create(0, 0), Position.create(0, 2)));

		workspaceChange
			.getTextEditChange(document)
			.add(
				TextEdit.insert(
					Position.create(shebang === '#!' ? 1 : 0, 0),
					`/* stylelint-disable ${code} */${os.EOL}`,
				),
			);

		return CodeAction.create(
			`Disable ${code} for the entire file`,
			workspaceChange.edit,
			CodeActionKind.QuickFix,
		);
	}

	#getOpenRuleDocAction({ code, codeDescription }: LSP.Diagnostic): CodeAction | undefined {
		const uri = codeDescription?.href;

		if (!uri) {
			return undefined;
		}

		const command = Command.create(`Open documentation for ${code}`, CommandId.OpenRuleDoc, {
			uri,
		});

		return CodeAction.create(`Show documentation for ${code}`, command, CodeActionKind.QuickFix);
	}

	async #getCodeActions(
		document: TextDocument,
		context: LSP.CodeActionContext,
	): Promise<CodeAction[]> {
		const only = context.only && new Set(context.only);

		this.#logger?.debug('Creating code actions', { only: context.only });

		// If asked to provide source or source-fix-all actions, only provide
		// actions for the whole document.
		if (
			only?.has(CodeActionKind.SourceFixAll) ||
			only?.has(StylelintCodeActionKind.StylelintSourceFixAll)
		) {
			this.#logger?.debug('Creating "source-fix-all" code action');

			const action = await this.#getAutoFixAllAction(document);

			return action ? [action] : [];
		}

		if (only?.has(CodeActionKind.Source)) {
			this.#logger?.debug('Creating "source" code action');

			const action = this.#getAutoFixAllCommandAction(document);

			return action ? [action] : [];
		}

		if (only && !only.has(CodeActionKind.QuickFix)) {
			this.#logger?.debug('No quick fix actions requested, skipping action creation');

			return [];
		}

		// Otherwise, provide specific actions for each problem.
		const actions = new RuleCodeActionsCollection();

		for (const diagnostic of context.diagnostics) {
			const { source, code } = diagnostic;

			// If the diagnostic is not from Stylelint, ignore it.
			if (source !== 'Stylelint' || typeof code !== 'string') {
				continue;
			}

			// If the diagnostic is for a disable report, don't create disable
			// rule actions. Creating disable rule actions for an invalid
			// disable wouldn't make any sense.
			if (
				code !== DisableReportRuleNames.Descriptionless &&
				code !== DisableReportRuleNames.Illegal &&
				code !== DisableReportRuleNames.InvalidScope &&
				code !== DisableReportRuleNames.Needless
			) {
				const options = await this.#context.getOptions(document.uri);
				const { location } = options.codeAction.disableRuleComment;

				this.#logger?.debug('Creating disable rule for line code action', { rule: code, location });

				actions.get(code).disableLine = this.#getDisableRuleLineAction(
					document,
					diagnostic,
					location,
				);

				if (!actions.get(code).disableFile) {
					this.#logger?.debug('Creating disable rule for file code action', { rule: code });

					actions.get(code).disableFile = this.#getDisableRuleFileAction(document, diagnostic);
				}
			}

			if (!actions.get(code).documentation) {
				this.#logger?.debug('Creating documentation code action', { rule: code });

				actions.get(code).documentation = this.#getOpenRuleDocAction(diagnostic);
			}
		}

		return [...actions];
	}
}
