import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as LSP from 'vscode-languageserver-protocol';
import type winston from 'winston';
import { CodeActionKind as StylelintCodeActionKind, CommandId, Notification } from '../types';
import {
	RuleCodeActionsCollection,
	createDisableRuleFileCodeAction,
	createDisableRuleLineCodeAction,
} from '../../utils/lsp';
import { isDisableReportRule } from '../../utils/stylelint';
import type {
	LanguageServerContext,
	LanguageServerModuleConstructorParameters,
	LanguageServerModule,
} from '../types';
import { InitializedNotification } from 'vscode-languageserver-protocol';

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

	onDidRegisterHandlers(): void {
		this.#logger?.debug('Registering onCodeAction handler');

		this.#context.connection.onCodeAction(async ({ context, textDocument: { uri } }) => {
			this.#logger?.debug('Received onCodeAction', { context, uri });

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
			const params = args?.[0] as { uri: string } | undefined;

			if (!params) {
				this.#logger?.debug('No URL provided, ignoring command request');

				return {};
			}

			const { uri } = params;

			this.#logger?.debug('Opening rule documentation', { uri });

			// Open URL in browser
			const showURIResponse = await this.#context.connection.window.showDocument({
				uri,
				external: true,
			});

			if (!showURIResponse.success) {
				this.#logger?.warn('Failed to open rule documentation', { uri });

				return new LSP.ResponseError(
					LSP.ErrorCodes.InternalError,
					'Failed to open rule documentation',
				);
			}

			return {};
		});

		this.#context.notifications.on(InitializedNotification.type, () =>
			this.#context.connection.sendNotification(Notification.DidRegisterCodeActionRequestHandler),
		);
	}

	async #getAutoFixAllAction(document: TextDocument): Promise<LSP.CodeAction | undefined> {
		const edits = await this.#context.getFixes(document);

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
		const command = LSP.Command.create(
			'Fix all Stylelint auto-fixable problems',
			CommandId.ApplyAutoFix,
			{ uri: document.uri, version: document.version },
		);

		return LSP.CodeAction.create(
			'Fix all Stylelint auto-fixable problems',
			command,
			LSP.CodeActionKind.Source,
		);
	}

	#getOpenRuleDocAction({ code, codeDescription }: LSP.Diagnostic): LSP.CodeAction | undefined {
		const uri = codeDescription?.href;

		if (!uri) {
			return undefined;
		}

		const command = LSP.Command.create(`Open documentation for ${code}`, CommandId.OpenRuleDoc, {
			uri,
		});

		return LSP.CodeAction.create(
			`Show documentation for ${code}`,
			command,
			LSP.CodeActionKind.QuickFix,
		);
	}

	async #getCodeActions(
		document: TextDocument,
		context: LSP.CodeActionContext,
	): Promise<LSP.CodeAction[]> {
		const only = context.only && new Set(context.only);

		this.#logger?.debug('Creating code actions', { only: context.only });

		// If asked to provide source or source-fix-all actions, only provide
		// actions for the whole document.
		if (
			only?.has(LSP.CodeActionKind.SourceFixAll) ||
			only?.has(StylelintCodeActionKind.StylelintSourceFixAll)
		) {
			this.#logger?.debug('Creating "source-fix-all" code action');

			const action = await this.#getAutoFixAllAction(document);

			return action ? [action] : [];
		}

		if (only?.has(LSP.CodeActionKind.Source)) {
			this.#logger?.debug('Creating "source" code action');

			return [this.#getAutoFixAllCommandAction(document)];
		}

		if (only && !only.has(LSP.CodeActionKind.QuickFix)) {
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
			if (!isDisableReportRule(code)) {
				const options = await this.#context.getOptions(document.uri);
				const { location } = options.codeAction.disableRuleComment;

				this.#logger?.debug('Creating disable rule for line code action', { rule: code, location });

				actions.get(code).disableLine = createDisableRuleLineCodeAction(
					document,
					diagnostic,
					location,
				);

				if (!actions.get(code).disableFile) {
					this.#logger?.debug('Creating disable rule for file code action', { rule: code });

					actions.get(code).disableFile = createDisableRuleFileCodeAction(document, diagnostic);
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
