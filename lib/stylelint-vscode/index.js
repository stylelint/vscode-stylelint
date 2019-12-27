'use strict';

const path = require('path');
const pathIsInside = require('path-is-inside');
const { at, has, intersection, isPlainObject, map, stubString } = require('lodash');
const { execSync } = require('child_process');
const { Files, TextDocument } = require('vscode-languageserver');
const { URI } = require('vscode-uri');

const arrayToError = require('../array-to-error');
const arrayToSentence = require('../array-to-sentence');
const inspectWithKind = require('../inspect-with-kind');
const stylelintWarningToVscodeDiagnostic = require('../stylelint-warning-to-vscode-diagnostic');

// https://github.com/stylelint/stylelint/blob/10.0.1/lib/getPostcssResult.js#L69-L81
const SUPPORTED_SYNTAXES = new Set([
	'css-in-js',
	'html',
	'less',
	'markdown',
	'sass',
	'scss',
	'sugarss',
]);

const LANGUAGE_EXTENSION_EXCEPTION_PAIRS = new Map([
	['javascript', 'css-in-js'],
	['javascriptreact', 'css-in-js'],
	['source.css.styled', 'css-in-js'],
	['source.markdown.math', 'markdown'],
	['styled-css', 'css-in-js'],
	['svelte', 'html'],
	['typescript', 'css-in-js'],
	['typescriptreact', 'css-in-js'],
	['vue-html', 'html'],
	['xml', 'html'],
	['xsl', 'html'],
]);

const UNSUPPORTED_OPTIONS = ['code', 'codeFilename', 'files', 'formatter'];

function quote(str) {
	return `\`${str}\``;
}

function processResults(resultContainer) {
	const { results } = resultContainer;

	// https://github.com/stylelint/stylelint/blob/10.0.1/lib/standalone.js#L114-L122
	if (results.length === 0) {
		return {
			diagnostics: [],
		};
	}

	const [{ invalidOptionWarnings, warnings }] = results;

	if (invalidOptionWarnings.length !== 0) {
		throw arrayToError(map(invalidOptionWarnings, 'text'), SyntaxError);
	}

	const diagnostics = warnings.map(stylelintWarningToVscodeDiagnostic);

	if (has(resultContainer, 'output')) {
		return {
			diagnostics,
			output: resultContainer.output,
		};
	}

	return {
		diagnostics,
	};
}

module.exports = async function stylelintVSCode(textDocument, options = {}, serverOptions = {}) {
	if (!TextDocument.is(textDocument)) {
		throw new TypeError(
			`Expected a TextDocument https://code.visualstudio.com/docs/extensionAPI/vscode-api#TextDocument, but got ${inspectWithKind(
				textDocument,
			)}.`,
		);
	}

	if (!isPlainObject(options)) {
		throw new TypeError(
			`Expected an object containing stylelint API options, but got ${inspectWithKind(options)}.`,
		);
	}

	const providedUnsupportedOptions = intersection(Object.keys(options), UNSUPPORTED_OPTIONS);

	if (providedUnsupportedOptions.length !== 0) {
		throw new TypeError(
			`${arrayToSentence(
				map(UNSUPPORTED_OPTIONS, quote),
			)} options are not supported because they will be derived from a document and there is no need to set them manually, but ${arrayToSentence(
				map(providedUnsupportedOptions, quote),
			)} was provided.`,
		);
	}

	const priorOptions = {
		code: textDocument.getText(),
		formatter: stubString,
	};
	const codeFilename = Files.uriToFilePath(textDocument.uri);
	let resultContainer;

	if (codeFilename) {
		priorOptions.codeFilename = codeFilename;
	} else {
		if (!has(options, 'syntax')) {
			if (SUPPORTED_SYNTAXES.has(textDocument.languageId)) {
				priorOptions.syntax = textDocument.languageId;
			} else {
				const syntax = LANGUAGE_EXTENSION_EXCEPTION_PAIRS.get(textDocument.languageId);

				if (syntax) {
					priorOptions.syntax = syntax;
				}
			}
		}

		if (!at(options, 'config.rules')[0]) {
			priorOptions.config = { rules: {} };
		}
	}

	try {
		resultContainer = await lint(
			{ ...options, ...priorOptions },
			{ ...serverOptions, textDocument },
		);
	} catch (err) {
		if (
			err.message.startsWith('No configuration provided for') ||
			err.message.includes('No rules found within configuration')
		) {
			// Check only CSS syntax errors without applying any stylelint rules
			return processResults(
				await lint(
					{
						...options,
						...priorOptions,
						config: {
							rules: {},
						},
						fix: false,
					},
					{ ...serverOptions, textDocument },
				),
			);
		}

		throw err;
	}

	return processResults(resultContainer);
};

async function lint(options, { connection, packageManager, textDocument }) {
	function trace(message, verbose) {
		connection.tracer.log(message, verbose);
	}

	let stylelint;

	try {
		const resolvedGlobalPackageManagerPath = globalPathGet(packageManager, trace);
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

	if (!stylelint || typeof stylelint.lint !== 'function') {
		// Use self module
		stylelint = require('stylelint');
	}

	return await stylelint.lint(options);
}

async function getWorkspaceFolder(document, connection) {
	const documentPath = URI.parse(document.uri).fsPath;

	if (documentPath) {
		const workspaceFolders = await connection.workspace.getWorkspaceFolders();

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

const globalPaths = {
	yarn: {
		cache: undefined,
		get(trace) {
			return Files.resolveGlobalYarnPath(trace);
		},
	},
	npm: {
		cache: undefined,
		get(trace) {
			return Files.resolveGlobalNodePath(trace);
		},
	},
	pnpm: {
		cache: undefined,
		get() {
			const pnpmPath = execSync('pnpm root -g')
				.toString()
				.trim();

			return pnpmPath;
		},
	},
};

function globalPathGet(packageManager, trace) {
	const pm = globalPaths[packageManager];

	if (pm) {
		if (pm.cache === undefined) {
			pm.cache = pm.get(trace);
		}

		return pm.cache;
	}

	return undefined;
}
