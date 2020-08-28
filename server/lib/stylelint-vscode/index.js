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
 * @typedef { import('stylelint') } StylelintModule
 * @typedef { import('vscode-languageserver-textdocument').TextDocument } TextDocument
 * @typedef { import('vscode-languageserver').IConnection } IConnection
 * @typedef { "npm" | "yarn" | "pnpm" } PackageManager
 * @typedef { {connection?: IConnection, packageManager?: PackageManager, stylelintPath?: string } } StylelintVSCodeOption
 * @typedef {object} StylelintVSCodeResult
 * @property {Diagnostic[]} diagnostics
 * @property {string} [output]
 * @property {({ diagnostic: Diagnostic, range: DisableReportRange })[]} [needlessDisables]
 * @property {({ diagnostic: Diagnostic, range: DisableReportRange })[]} [invalidScopeDisables]
 * @typedef { import('stylelint').LinterOptions } BaseStylelintLinterOptions
 * @typedef { Partial<BaseStylelintLinterOptions> } StylelintLinterOptions
 * @typedef { import('stylelint').SyntaxType } SyntaxType
 * @typedef { {unusedRule:string,start:number,end:?number} } DisableReportRange
 * @typedef { { source?: string, ranges: DisableReportRange[] } } StylelintDisableReportEntry
 * @typedef { import('../stylelint-warning-to-vscode-diagnostic').RuleDocUrlProvider } RuleDocUrlProvider
 * @typedef { (message: string, verbose?: string) => void } TracerFn
 */

// https://github.com/stylelint/stylelint/blob/12.0.1/lib/getPostcssResult.js#L82-L88
/** @type {Set<SyntaxType> } */
const SUPPORTED_SYNTAXES = new Set([
	'css-in-js',
	'html',
	'less',
	'markdown',
	'sass',
	'scss',
	'sugarss',
]);

/** @type {Map<string, SyntaxType> } */
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

/**
 * @param {string} lang
 * @returns {lang is SyntaxType}
 */
function isSupportedSyntax(lang) {
	// @ts-ignore
	return SUPPORTED_SYNTAXES.has(lang);
}

/**
 * @param {string} str
 * @returns {string}
 */
function quote(str) {
	return `\`${str}\``;
}

/**
 * @param {import('stylelint').LinterResult} resultContainer
 * @param {TextDocument} textDocument
 * @param {RuleDocUrlProvider} ruleDocUrlProvider
 * @returns {StylelintVSCodeResult}
 */
function processResults(resultContainer, textDocument, ruleDocUrlProvider) {
	const { results } = resultContainer;
	/** @type {StylelintDisableReportEntry[]} */
	// @ts-expect-error -- The stylelint type is old.
	const needlessDisables = resultContainer.needlessDisables;
	/** @type {StylelintDisableReportEntry[]} */
	// @ts-expect-error -- The stylelint type is old.
	const invalidScopeDisables = resultContainer.invalidScopeDisables;

	// https://github.com/stylelint/stylelint/blob/12.0.1/lib/standalone.js#L128-L134
	if (
		results.length === 0 &&
		(!needlessDisables || needlessDisables.length === 0) &&
		(!invalidScopeDisables || invalidScopeDisables.length === 0)
	) {
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
	let invalidScopeDisableResults;

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

	const invalidScopeDisableSourceReport = invalidScopeDisables && invalidScopeDisables[0];

	if (invalidScopeDisableSourceReport) {
		invalidScopeDisableResults = [];

		for (const range of invalidScopeDisableSourceReport.ranges) {
			const diagnostic = stylelintDisableOptionsReportRangeToVscodeDiagnostic(range, textDocument);

			diagnostics.push(diagnostic);
			invalidScopeDisableResults.push({
				range,
				diagnostic,
			});
		}
	}

	diagnostics.push(
		...warnings.map((warning) => stylelintWarningToVscodeDiagnostic(warning, ruleDocUrlProvider)),
	);

	if (has(resultContainer, 'output') && resultContainer.output) {
		return {
			diagnostics,
			output: resultContainer.output,
			...(needlessDisableResults ? { needlessDisables: needlessDisableResults } : {}),
			...(invalidScopeDisableResults ? { invalidScopeDisables: invalidScopeDisableResults } : {}),
		};
	}

	return {
		diagnostics,
		...(needlessDisableResults ? { needlessDisables: needlessDisableResults } : {}),
		...(invalidScopeDisableResults ? { invalidScopeDisables: invalidScopeDisableResults } : {}),
	};
}

/**
 * @param {TextDocument} textDocument
 * @param {StylelintLinterOptions} options
 * @param {StylelintVSCodeOption} serverOptions
 * @returns {Promise<StylelintVSCodeResult>}
 */
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

	/** @type {StylelintLinterOptions} */
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
			if (isSupportedSyntax(textDocument.languageId)) {
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

	const stylelint = await resolveStylelint({ ...serverOptions, textDocument });

	try {
		resultContainer = await stylelint.lint({ ...options, ...priorOptions });
	} catch (err) {
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
				textDocument,
				createRuleDocUrlProvider(stylelint),
			);
		}

		throw err;
	}

	return processResults(resultContainer, textDocument, createRuleDocUrlProvider(stylelint));
};

/**
 * @param {StylelintVSCodeOption & {textDocument: TextDocument} } options
 * @returns {Promise<StylelintModule>}
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

		try {
			stylelint = require(customStylelintPath);
		} catch (err) {
			connection &&
				connection.window.showErrorMessage(
					`stylelint: cannot resolve "stylelintPath": ${customStylelintPath}`,
				);
			throw err;
		}

		if (stylelint && typeof stylelint.lint === 'function') {
			return stylelint;
		}

		connection &&
			connection.window.showErrorMessage(
				`stylelint: cannot resolve "stylelintPath": ${customStylelintPath}`,
			);
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

	return stylelint;
}

/**
 * @param {StylelintModule} stylelint
 * @returns {RuleDocUrlProvider}
 */
function createRuleDocUrlProvider(stylelint) {
	return (rule) => {
		// @ts-expect-error -- The stylelint type is old.
		if (stylelint.rules && stylelint.rules[rule]) {
			return `https://stylelint.io/user-guide/rules/${rule}`;
		}

		return null;
	};
}

/**
 * @param {TextDocument} document
 * @param {IConnection} [connection]
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

/**
 * @type { { [key in PackageManager]: { cache?: string, get: (trace: TracerFn) => string | undefined } } }
 */
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
			const pnpmPath = execSync('pnpm root -g').toString().trim();

			return pnpmPath;
		},
	},
};

/**
 * @param {PackageManager} packageManager
 * @param {TracerFn} trace
 * @returns {string | undefined}
 */
function globalPathGet(packageManager = 'npm', trace) {
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
 * @returns {Diagnostic}
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

/**
 * @param {DisableReportRange} range
 * @returns {Position}
 */
function convertStartPosition(range) {
	return Position.create(range.start - 1, 0);
}

/**
 * @param {DisableReportRange} range
 * @param {TextDocument} textDocument
 * @returns {Position}
 */
function convertEndPosition(range, textDocument) {
	if (range.end) {
		return textDocument.positionAt(textDocument.offsetAt(Position.create(range.end, 0)) - 1);
	}

	return textDocument.positionAt(textDocument.getText().length);
}
