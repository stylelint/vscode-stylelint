'use strict';

const path = require('path');
const pathIsInside = require('path-is-inside');
const { at, has, intersection, isPlainObject, map, stubString } = require('lodash');
const { Diagnostic, DiagnosticSeverity, Position, Range } = require('vscode-languageserver-types');
const { execSync } = require('child_process');
const { Files, TextDocument } = require('vscode-languageserver');
const { URI } = require('vscode-uri');

const arrayToError = require('../array-to-error');
const arrayToSentence = require('../array-to-sentence');
const inspectWithKind = require('../inspect-with-kind');
const stylelintWarningToVscodeDiagnostic = require('../stylelint-warning-to-vscode-diagnostic');

/**
 * @typedef { {unusedRule:string,start:number,end:?number} } DisableReportRange
 */

// https://github.com/stylelint/stylelint/blob/12.0.1/lib/getPostcssResult.js#L82-L88
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

/**
 *
 * @param {*} resultContainer
 * @param {*} textDocument
 * @returns { { diagnostics: Diagnostic[], output?: string, needlessDisables?: ({ diagnostic: Diagnostic, range: DisableReportRange })[] } }
 */
function processResults(resultContainer, textDocument) {
	const { results, needlessDisables } = resultContainer;

	// https://github.com/stylelint/stylelint/blob/12.0.1/lib/standalone.js#L128-L134
	if (results.length === 0 && (!needlessDisables || needlessDisables.length === 0)) {
		return {
			diagnostics: [],
		};
	}

	const [{ invalidOptionWarnings, warnings, ignored }] = results;

	if (ignored) {
		return {
			diagnostics: [],
		};
	}

	if (invalidOptionWarnings.length !== 0) {
		throw arrayToError(map(invalidOptionWarnings, 'text'), SyntaxError);
	}

	const diagnostics = [];
	let needlessDisableResults;

	const needlessDisableSourceReport = needlessDisables && needlessDisables[0];

	if (needlessDisableSourceReport) {
		needlessDisableResults = [];

		for (const range of needlessDisableSourceReport.ranges) {
			const diagnostic = stylelintDisableOptionsReportRangeToVscodeDiagnostic(range, textDocument);

			diagnostics.push(diagnostic);
			needlessDisableResults.push({
				range,
				diagnostic,
			});
		}
	}

	diagnostics.push(...warnings.map(stylelintWarningToVscodeDiagnostic));

	if (has(resultContainer, 'output') && resultContainer.output) {
		return {
			diagnostics,
			output: resultContainer.output,
			...(needlessDisableResults ? { needlessDisables: needlessDisableResults } : {}),
		};
	}

	return {
		diagnostics,
		...(needlessDisableResults ? { needlessDisables: needlessDisableResults } : {}),
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
					},
					{ ...serverOptions, textDocument },
				),
			);
		}

		throw err;
	}

	return processResults(resultContainer, textDocument);
};

async function lint(
	options,
	{ connection, packageManager, stylelintPath: customStylelintPath, textDocument },
) {
	function trace(message, verbose) {
		connection.tracer.log(message, verbose);
	}

	let stylelint;

	if (customStylelintPath) {
		try {
			stylelint = require(customStylelintPath);
		} catch (err) {
			connection.window.showErrorMessage(
				`stylelint: cannot resolve "stylelintPath": ${customStylelintPath}`,
			);
			throw err;
		}

		if (stylelint && typeof stylelint.lint === 'function') {
			return await stylelint.lint(options);
		}

		connection.window.showErrorMessage(
			`stylelint: cannot resolve "stylelintPath": ${customStylelintPath}`,
		);
	}

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

/**
 * @param {DisableReportRange} range
 * @param {TextDocument} textDocument
 */
function stylelintDisableOptionsReportRangeToVscodeDiagnostic(range, textDocument) {
	let message = `unused rule: ${range.unusedRule}, start line: ${range.start}`;
	const startPosition = convertStartPosition(range);
	const endPosition = convertEndPosition(range, textDocument);

	if (range.end !== undefined) {
		message += `, end line: ${range.end}`;
	}

	return Diagnostic.create(
		Range.create(startPosition, endPosition),
		message,
		DiagnosticSeverity.Warning,
		range.unusedRule,
		'stylelint',
	);
}

function convertStartPosition(range) {
	return Position.create(range.start - 1, 0);
}

function convertEndPosition(range, textDocument) {
	if (range.end) {
		return textDocument.positionAt(textDocument.offsetAt(Position.create(range.end, 0)) - 1);
	} else {
		return textDocument.positionAt(textDocument.getText().length);
	}
}
