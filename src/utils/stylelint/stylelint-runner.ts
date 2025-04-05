import os from 'os';
import { URI } from 'vscode-uri';
import type { Connection } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type stylelint from 'stylelint';
import type winston from 'winston';

import { StylelintResolver } from '../packages/index';
import { getWorkspaceFolder } from '../documents/index';
import { processLinterResult } from './process-linter-result';
import { buildStylelintOptions } from './build-stylelint-options';
import type { LintDiagnostics, RunnerOptions } from './types';

/**
 * Runs Stylelint in VS Code.
 */
export class StylelintRunner {
	/**
	 * The language server connection.
	 */
	#connection: Connection | undefined;

	/**
	 * The logger to use, if any.
	 */
	#logger: winston.Logger | undefined;

	/**
	 * The Stylelint resolver.
	 */
	#stylelintResolver: StylelintResolver;

	constructor(connection?: Connection, logger?: winston.Logger, resolver?: StylelintResolver) {
		this.#connection = connection;
		this.#logger = logger;
		this.#stylelintResolver = resolver ?? new StylelintResolver(connection, logger);
	}

	/**
	 * Lints the given document using Stylelint. The linting result is then
	 * converted to LSP diagnostics and returned.
	 * @param document
	 * @param linterOptions
	 * @param extensionOptions
	 */
	async lintDocument(
		document: TextDocument,
		linterOptions: stylelint.LinterOptions = {},
		runnerOptions: RunnerOptions = {},
	): Promise<LintDiagnostics> {
		const workspaceFolder =
			this.#connection && (await getWorkspaceFolder(this.#connection, document));

		const result = await this.#stylelintResolver.resolve(runnerOptions, document);

		if (!result) {
			this.#logger?.info('No Stylelint found with which to lint document', {
				uri: document.uri,
				options: runnerOptions,
			});

			return { diagnostics: [] };
		}

		const { fsPath } = URI.parse(document.uri);

		// Workaround for Stylelint treating paths as case-sensitive on Windows
		// If the drive letter is lowercase, we need to convert it to uppercase
		// See https://github.com/stylelint/stylelint/issues/5594
		// TODO: Remove once fixed upstream
		const codeFilename =
			os.platform() === 'win32'
				? fsPath.replace(/^[a-z]:/, (match) => match.toUpperCase())
				: fsPath;

		const options: stylelint.LinterOptions = {
			...(await buildStylelintOptions(document.uri, workspaceFolder, linterOptions, runnerOptions)),
			code: document.getText(),
			formatter: () => '',
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore -- (TS2353) `computeEditInfo` option is available since v16.15.
			computeEditInfo: true,
		};

		if (codeFilename) {
			options.codeFilename = codeFilename;
		} else if (!linterOptions?.config?.rules) {
			options.config = { rules: {} };
		}

		if (this.#logger?.isDebugEnabled()) {
			this.#logger?.debug('Running Stylelint', {
				options: { ...options, code: '...' },
			});
		}

		try {
			return processLinterResult(result.stylelint, await result.stylelint.lint(options));
		} catch (err) {
			if (
				err instanceof Error &&
				(err.message.startsWith('No configuration provided for') ||
					err.message.includes('No rules found within configuration'))
			) {
				// Check only CSS syntax errors without applying any Stylelint rules
				return processLinterResult(
					result.stylelint,
					await result.stylelint.lint({ ...options, config: { rules: {} } }),
				);
			}

			throw err;
		}
	}
}
