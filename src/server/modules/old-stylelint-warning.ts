import path from 'path';
import fs from 'fs/promises';
import semver from 'semver';
import pathIsInside from 'path-is-inside';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type LSP from 'vscode-languageserver-protocol';
import { getWorkspaceFolder } from '../../utils/documents/index';
import { findPackageRoot } from '../../utils/packages/index';
import type {
	LanguageServerContext,
	LanguageServerModuleConstructorParameters,
	LanguageServerModule,
} from '../types';
import type winston from 'winston';

export class OldStylelintWarningModule implements LanguageServerModule {
	static id = 'old-stylelint-warning';

	/**
	 * The language server context.
	 */
	#context: LanguageServerContext;

	/**
	 * The logger to use, if any.
	 */
	#logger: winston.Logger | undefined;

	/**
	 * Set of workspaces for which Stylelint's version has already been checked.
	 */
	#checkedWorkspaces = new Set<string>();

	/**
	 * Whether or not to provide the URL to the migration guide.
	 */
	#openMigrationGuide = false;

	/**
	 * Disposables for handlers.
	 */
	#disposables: LSP.Disposable[] = [];

	constructor({ context, logger }: LanguageServerModuleConstructorParameters) {
		this.#context = context;
		this.#logger = logger;
	}

	dispose(): void {
		this.#disposables.forEach((disposable) => disposable.dispose());
		this.#disposables.length = 0;
	}

	onInitialize({ capabilities }: LSP.InitializeParams): void {
		this.#openMigrationGuide = capabilities.window?.showDocument?.support ?? false;
	}

	async #getStylelintVersion(
		document: TextDocument,
		workspaceFolder: string,
	): Promise<string | undefined> {
		const result = await this.#context.resolveStylelint(document);

		if (!result) {
			this.#logger?.debug('Stylelint not found', {
				uri: document.uri,
			});

			return undefined;
		}

		const packageDir = await findPackageRoot(result.resolvedPath);

		if (!packageDir) {
			this.#logger?.debug('Stylelint package root not found', {
				uri: document.uri,
			});

			return undefined;
		}

		if (!pathIsInside(packageDir, workspaceFolder)) {
			this.#logger?.debug('Stylelint package root is not inside the workspace', {
				uri: document.uri,
			});

			return undefined;
		}

		const manifestPath = path.join(packageDir, 'package.json');

		try {
			const rawManifest = await fs.readFile(manifestPath, 'utf8');

			const manifest = JSON.parse(rawManifest) as { version?: string };

			return manifest.version;
		} catch (error) {
			this.#logger?.debug('Stylelint package manifest could not be read', {
				uri: document.uri,
				manifestPath,
				error,
			});

			return undefined;
		}
	}

	async #check(document: TextDocument): Promise<string | undefined> {
		const workspaceFolder = await getWorkspaceFolder(this.#context.connection, document);

		if (!workspaceFolder) {
			this.#logger?.debug('Document not part of a workspace, ignoring', {
				uri: document.uri,
			});

			return undefined;
		}

		if (this.#checkedWorkspaces.has(workspaceFolder)) {
			this.#logger?.debug('Document has already been checked, ignoring', {
				uri: document.uri,
			});

			return undefined;
		}

		this.#checkedWorkspaces.add(workspaceFolder);

		const stylelintVersion = await this.#getStylelintVersion(document, workspaceFolder);

		if (!stylelintVersion) {
			return undefined;
		}

		try {
			const coerced = semver.coerce(stylelintVersion);

			if (!coerced) {
				throw new Error(`Could not coerce version "${stylelintVersion}"`);
			}

			return semver.lt(coerced, '14.0.0') ? stylelintVersion : undefined;
		} catch (error) {
			this.#logger?.debug('Stylelint version could not be parsed', {
				uri: document.uri,
				version: stylelintVersion,
				error,
			});

			return undefined;
		}
	}

	onDidRegisterHandlers(): void {
		this.#logger?.debug('Registering onDidOpen handler');

		this.#disposables.push(
			this.#context.documents.onDidOpen(async ({ document }) => {
				const stylelintVersion = await this.#check(document);

				if (!stylelintVersion) {
					return;
				}

				this.#logger?.warn(`Found unsupported version of Stylelint: ${stylelintVersion}`);

				const message = `Stylelint version ${stylelintVersion} is no longer supported. While it may continue to work for a while, you may encounter unexpected behavior. Please upgrade to version 14.0.0 or newer. See the migration guide for more information.`;

				if (!this.#openMigrationGuide) {
					this.#context.connection.window.showWarningMessage(message);

					return;
				}

				const warningResponse = await this.#context.connection.window.showWarningMessage(message, {
					title: 'Open migration guide',
				});

				if (warningResponse?.title === 'Open migration guide') {
					// Open URL in browser
					const showURIResponse = await this.#context.connection.window.showDocument({
						uri: 'https://github.com/stylelint/vscode-stylelint#migrating-from-vscode-stylelint-0xstylelint-13x',
						external: true,
					});

					if (!showURIResponse.success) {
						this.#logger?.warn('Failed to open migration guide');
					}
				}
			}),
		);

		this.#logger?.debug('onDidOpen handler registered');
	}
}
