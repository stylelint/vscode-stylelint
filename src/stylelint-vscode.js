'use strict';

const os = require('os');
const path = require('path');
const pathIsInside = require('path-is-inside');
const { Files } = require('vscode-languageserver/node');
const { URI } = require('vscode-uri');
const { getGlobalPathResolver } = require('./utils/packages');

const stylelintWarningToVscodeDiagnostic = require('./warnings-to-diagnostics');

class InvalidOptionError extends Error {
	/**
	 * @param {string[]} reasons
	 */
	constructor(reasons) {
		super(reasons.join('\n'));
		this.reasons = reasons;
	}
}

/**
 * @param {stylelint.LinterResult} resultContainer
 * @param {RuleDocUrlProvider} ruleDocUrlProvider
 * @returns {StylelintVSCodeResult}
 */
function processResults(resultContainer, ruleDocUrlProvider) {
	const { results } = resultContainer;

	if (results.length === 0) {
		return { diagnostics: [] };
	}

	const [{ invalidOptionWarnings, warnings, ignored }] = results;

	if (ignored) {
		return { diagnostics: [] };
	}

	if (invalidOptionWarnings.length !== 0) {
		throw new InvalidOptionError(invalidOptionWarnings.map((warning) => warning.text));
	}

	const diagnostics = warnings.map((warning) =>
		stylelintWarningToVscodeDiagnostic(warning, ruleDocUrlProvider),
	);

	if (Object.prototype.hasOwnProperty.call(resultContainer, 'output') && resultContainer.output) {
		return {
			diagnostics,
			output: resultContainer.output,
		};
	}

	return { diagnostics };
}

/**
 * @param {lsp.TextDocument} textDocument
 * @param {stylelint.LinterOptions} options
 * @param {StylelintVSCodeOptions} serverOptions
 * @returns {Promise<StylelintVSCodeResult>}
 */
module.exports = async function stylelintVSCode(textDocument, options = {}, serverOptions = {}) {
	/** @type {stylelint.LinterOptions} */
	const priorOptions = {
		code: textDocument.getText(),
		formatter: () => '',
	};
	const { fsPath } = URI.parse(textDocument.uri);

	// Workaround for Stylelint treating paths as case-sensitive on Windows
	// If the drive letter is lowercase, we need to convert it to uppercase
	// See https://github.com/stylelint/stylelint/issues/5594
	// TODO: Remove once fixed upstream
	const codeFilename =
		os.platform() === 'win32' ? fsPath.replace(/^[a-z]:/, (match) => match.toUpperCase()) : fsPath;
	let resultContainer;

	if (codeFilename) {
		priorOptions.codeFilename = codeFilename;
	} else if (!options?.config?.rules) {
		priorOptions.config = { rules: {} };
	}

	const stylelint = await resolveStylelint({ ...serverOptions, textDocument });

	if (!stylelint) {
		return {
			diagnostics: [],
		};
	}

	try {
		resultContainer = await stylelint.lint({ ...options, ...priorOptions });
	} catch (err) {
		if (!(err instanceof Error)) {
			throw err;
		}

		if (
			err.message.startsWith('No configuration provided for') ||
			err.message.includes('No rules found within configuration')
		) {
			// Check only CSS syntax errors without applying any stylelint rules
			return processResults(
				await stylelint.lint({
					...options,
					...priorOptions,
					config: {
						rules: {},
					},
				}),
				createRuleDocUrlProvider(stylelint),
			);
		}

		throw err;
	}

	return processResults(resultContainer, createRuleDocUrlProvider(stylelint));
};

/** @type {GlobalPathResolver | undefined} */
let globalPathResolver;

/**
 * @param {StylelintVSCodeOptions & {textDocument: lsp.TextDocument} } options
 * @returns {Promise<stylelint.PublicApi | undefined>}
 */
async function resolveStylelint({
	connection,
	packageManager,
	stylelintPath: customStylelintPath,
	textDocument,
}) {
	/** @type {TracerFn} */
	function trace(message, verbose) {
		connection && connection.tracer.log(message, verbose);
	}

	if (customStylelintPath) {
		let stylelint;

		const errorMessage = `stylelint: cannot resolve "stylelintPath": ${customStylelintPath}`;
		const consoleErrorMessage = `Failed to load stylelint from ${customStylelintPath}.`;

		try {
			stylelint = require(customStylelintPath);
		} catch (err) {
			connection?.console.error(consoleErrorMessage);
			connection?.window.showErrorMessage(errorMessage);
			throw err;
		}

		if (stylelint && typeof stylelint.lint === 'function') {
			return stylelint;
		}

		connection?.console.error(consoleErrorMessage);
		connection?.window.showErrorMessage(errorMessage);
	}

	let stylelint;

	try {
		if (!globalPathResolver) {
			globalPathResolver = getGlobalPathResolver();
		}

		/** @type {string | undefined} */
		const resolvedGlobalPackageManagerPath = packageManager
			? await globalPathResolver.resolve(packageManager, trace)
			: undefined;
		const uri = URI.parse(textDocument.uri);

		let cwd;

		if (uri.scheme === 'file') {
			const file = uri.fsPath;
			const directory = path.dirname(file);

			cwd = directory;
		} else {
			const workspaceFolder = await getWorkspaceFolder(textDocument, connection);

			cwd = workspaceFolder;
		}

		const stylelintPath = await Files.resolve(
			'stylelint',
			resolvedGlobalPackageManagerPath,
			cwd,
			trace,
		);

		stylelint = require(stylelintPath);
	} catch {
		// ignore
	}

	if (!stylelint) {
		connection?.console.error(
			'Failed to load stylelint either globally or from the current workspace.',
		);

		return undefined;
	}

	if (typeof stylelint.lint !== 'function') {
		const errorMessage = 'stylelint.lint is not a function.';

		connection?.console.error(errorMessage);
		connection?.window.showErrorMessage(errorMessage);

		return undefined;
	}

	return stylelint;
}

/**
 * @param {stylelint.PublicApi} stylelint
 * @returns {RuleDocUrlProvider}
 */
function createRuleDocUrlProvider(stylelint) {
	return (rule) => {
		if (stylelint.rules && stylelint.rules[rule]) {
			return `https://stylelint.io/user-guide/rules/${rule}`;
		}

		return null;
	};
}

/**
 * @param {lsp.TextDocument} document
 * @param {lsp.Connection} [connection]
 * @returns {Promise<string | undefined>}
 */
async function getWorkspaceFolder(document, connection) {
	const documentPath = URI.parse(document.uri).fsPath;

	if (documentPath) {
		const workspaceFolders = connection && (await connection.workspace.getWorkspaceFolders());

		if (workspaceFolders) {
			for (const { uri } of workspaceFolders) {
				const workspacePath = URI.parse(uri).fsPath;

				if (pathIsInside(documentPath, workspacePath)) {
					return workspacePath;
				}
			}
		}
	}

	return undefined;
}
