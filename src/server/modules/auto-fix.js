'use strict';

const { WorkspaceChange } = require('vscode-languageserver-protocol');
const { CommandId } = require('../../utils/types');

/**
 * @implements {LanguageServerModule}
 */
class AutoFixModule {
	static id = 'auto-fix';

	/**
	 * The language server context.
	 * @type {LanguageServerContext}
	 */
	#context;

	/**
	 * The logger to use, if any.
	 * @type {winston.Logger | undefined}
	 */
	#logger;

	/**
	 * @param {LanguageServerModuleConstructorParameters} params
	 */
	constructor({ context, logger }) {
		this.#context = context;
		this.#logger = logger;
	}

	/**
	 * @param {lsp.TextDocument} document
	 * @returns {boolean}
	 */
	#shouldAutoFix(document) {
		return this.#context.options.validate.includes(document.languageId);
	}

	/**
	 * @returns {Partial<lsp.InitializeResult>}
	 */
	onInitialize() {
		return {
			capabilities: {
				executeCommandProvider: {
					commands: [CommandId.ApplyAutoFix],
				},
			},
		};
	}

	/**
	 * @returns {void}
	 */
	onDidRegisterHandlers() {
		this.#logger?.debug('Registering onExecuteCommand handler');

		this.#context.connection.onExecuteCommand(async ({ command, arguments: args }) => {
			this.#logger?.debug('Received onExecuteCommand', { command, arguments: args });

			if (command !== CommandId.ApplyAutoFix || !args) {
				return {};
			}

			/** @type { { version: number, uri: string } } */
			const identifier = args[0];
			const uri = identifier.uri;
			const document = this.#context.documents.get(uri);

			if (!document || !this.#shouldAutoFix(document)) {
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

		this.#logger?.debug('onExecuteCommand handler registered');
	}
}

module.exports = {
	AutoFixModule,
};
