import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocumentChangeEvent } from 'vscode-languageserver/node';
import {
	DidChangeWatchedFilesNotification,
	type DidChangeWatchedFilesParams,
} from 'vscode-languageserver-protocol';

import { inject } from '../../../di/index.js';
import { lspService, notification, textDocumentEvent } from '../../decorators.js';
import { StylelintRunnerService } from '../stylelint-runtime/stylelint-runner.service.js';

@lspService()
@inject({
	inject: [StylelintRunnerService],
})
export class WorkspaceActivityLspService {
	readonly #runner: StylelintRunnerService;

	constructor(runner: StylelintRunnerService) {
		this.#runner = runner;
	}

	@textDocumentEvent('onDidOpen')
	async handleDocumentOpened({ document }: TextDocumentChangeEvent<TextDocument>): Promise<void> {
		await this.#runner.handleDocumentOpened(document);
	}

	@notification(DidChangeWatchedFilesNotification.type)
	handleWatchedFilesChanged(params: DidChangeWatchedFilesParams): void {
		this.#runner.handleWatchedFilesChanged(params.changes);
	}
}
