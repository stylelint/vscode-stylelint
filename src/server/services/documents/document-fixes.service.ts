import type stylelint from 'stylelint';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextEdit } from 'vscode-languageserver-types';
import type winston from 'winston';
import { createToken, inject } from '../../../di/index.js';
import { getFixes } from '../../utils/index.js';
import { type LoggingService, loggingServiceToken } from '../infrastructure/logging.service.js';
import { StylelintRunnerService } from '../stylelint-runtime/stylelint-runner.service.js';
import { WorkspaceOptionsService } from '../workspace/workspace-options.service.js';

export const getFixesFnToken = createToken<typeof getFixes>('DocumentFixesGetFixesFn');

@inject({
	inject: [StylelintRunnerService, WorkspaceOptionsService, loggingServiceToken, getFixesFnToken],
})
export class DocumentFixesService {
	#runner: StylelintRunnerService;
	#options: WorkspaceOptionsService;
	#logger?: winston.Logger;
	#getFixes: typeof getFixes;

	constructor(
		runner: StylelintRunnerService,
		options: WorkspaceOptionsService,
		loggingService: LoggingService,
		getFixesFn: typeof getFixes,
	) {
		this.#runner = runner;
		this.#options = options;
		this.#logger = loggingService.createLogger(DocumentFixesService);
		this.#getFixes = getFixesFn;
	}

	async getFixes(
		document: TextDocument,
		linterOptions: stylelint.LinterOptions = {},
	): Promise<TextEdit[]> {
		try {
			const options = await this.#options.getOptions(document.uri);
			const edits = await this.#getFixes(this.#runner, document, linterOptions, options);

			this.#logger?.debug('Fixes retrieved', { uri: document.uri, edits });

			return edits;
		} catch (error) {
			this.#logger?.error('Error getting fixes', { uri: document.uri, error });

			return [];
		}
	}
}
