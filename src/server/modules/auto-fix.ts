import type { TextDocument } from 'vscode-languageserver-textdocument';
import { WorkspaceChange } from 'vscode-languageserver-protocol';
import type LSP from 'vscode-languageserver-protocol';
import { CommandId } from '../types';
import type {
	LanguageServerContext,
	LanguageServerModuleConstructorParameters,
	LanguageServerModule,
} from '../types';
import type winston from 'winston';

export class AutoFixModule implements LanguageServerModule {
	static id = 'auto-fix';

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

	async #shouldAutoFix(document: TextDocument): Promise<boolean> {
		const options = await this.#context.getOptions(document.uri);

		return options.validate.includes(document.languageId);
	}

	onInitialize(): Partial<LSP.InitializeResult> {
		return {
			capabilities: {
				executeCommandProvider: {
					commands: [CommandId.ApplyAutoFix],
				},
			},
		};
	}

	onDidRegisterHandlers(): void {
		this.#logger?.debug('Registering onExecuteCommand handler');

		this.#context.commands.on(CommandId.ApplyAutoFix, async ({ arguments: args }) => {
			if (!args) {
				return {};
			}

			const identifier = args[0] as { version: number; uri: string };
			const uri = identifier.uri;
			const document = this.#context.documents.get(uri);

			if (!document || !(await this.#shouldAutoFix(document))) {
				if (this.#logger?.isDebugEnabled()) {
					if (!document) {
						this.#logger.debug('Unknown document, ignoring', { uri });
					} else {
						this.#logger.debug('Document should not be auto-fixed, ignoring', {
							uri,
							language: document.languageId,
						});
					}
				}

				return {};
			}

			if (identifier.version !== document.version) {
				this.#logger?.debug('Document has been modified, ignoring', { uri });

				return {};
			}

			const workspaceChange = new WorkspaceChange();
			const textChange = workspaceChange.getTextEditChange(identifier);

			const edits = await this.#context.getFixes(document);

			edits.forEach((edit) => textChange.add(edit));

			this.#logger?.debug('Applying fixes', { uri, edits });

			try {
				const response = await this.#context.connection.workspace.applyEdit(workspaceChange.edit);

				if (!response.applied) {
					this.#logger?.debug('Failed to apply fixes', { uri, response });
				}
			} catch (error) {
				this.#logger?.debug('Failed to apply fixes', { uri, error });
			}

			return {};
		});
	}
}
