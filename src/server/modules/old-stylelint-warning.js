'use strict';

const path = require('path');
const fs = require('fs/promises');
const semver = require('semver');
const { getWorkspaceFolder } = require('../../utils/documents');
const { findPackageRoot } = require('../../utils/packages');

/**
 * @implements {LanguageServerModule}
 */
class OldStylelintWarningModule {
	static id = 'old-stylelint-warning';

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
	 * Set of workspaces for which Stylelint's version has already been checked.
	 * @type {Set<string>}
	 */
	#checkedWorkspaces = new Set();

	/**
	 * Whether or not to provide the URL to the migration guide.
	 * @type {boolean}
	 */
	#openMigrationGuide = false;

	/**
	 * @param {LanguageServerModuleConstructorParameters} params
	 */
	constructor({ context, logger }) {
		this.#context = context;
		this.#logger = logger;
	}

	/**
	 * @param {lsp.InitializeParams} params
	 * @returns {void}
	 */
	onInitialize({ capabilities }) {
		this.#openMigrationGuide = capabilities.window?.showDocument?.support ?? false;
	}

	/**
	 * @param {lsp.TextDocument} document
	 * @returns {Promise<string | undefined>}
	 */
	async #getStylelintVersion(document) {
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

		const manifestPath = path.join(packageDir, 'package.json');

		try {
			const rawManifest = await fs.readFile(manifestPath, 'utf8');

			const manifest = JSON.parse(rawManifest);

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

	/**
	 * @param {lsp.TextDocument} document
	 * @returns {Promise<string | undefined>}
	 */
	async #check(document) {
		if (!this.#context.options.validate.includes(document.languageId)) {
			this.#logger?.debug('Document should not be validated, ignoring', {
				uri: document.uri,
				language: document.languageId,
			});

			return undefined;
		}

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

		const stylelintVersion = await this.#getStylelintVersion(document);

		try {
			return stylelintVersion && semver.lt(stylelintVersion, '14.0.0')
				? stylelintVersion
				: undefined;
		} catch (error) {
			this.#logger?.debug('Stylelint version could not be parsed', {
				uri: document.uri,
				version: stylelintVersion,
				error,
			});

			return undefined;
		}
	}

	/**
	 * @returns {void}
	 */
	onDidRegisterHandlers() {
		this.#logger?.debug('Registering onDidOpen handler');

		this.#context.documents.onDidOpen(async ({ document }) => {
			const stylelintVersion = await this.#check(document);

			if (!stylelintVersion) {
				return;
			}

			this.#logger?.warn(`Found unsupported version of Stylelint: ${stylelintVersion}`);

			const message = `Stylelint version ${stylelintVersion} is no longer supported — you may encounter unexpected behavior. Please upgrade to version 14.0.0 or newer. See the migration guide for more information.`;

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
		});

		this.#logger?.debug('onDidOpen handler registered');
	}
}

module.exports = {
	OldStylelintWarningModule,
};
