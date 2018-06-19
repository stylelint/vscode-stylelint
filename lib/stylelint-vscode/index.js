'use strict';

const {extname} = require('path');

const arrayToError = require('array-to-error');
const arrayToSentence = require('array-to-sentence');
const {intersection, isPlainObject, last, map} = require('lodash');
const inspectWithKind = require('inspect-with-kind');
const {lint} = require('stylelint');
const {TextDocument, Files} = require('vscode-languageserver');
const stylelintWarningToVscodeDiagnostic = require('stylelint-warning-to-vscode-diagnostic');

// https://github.com/stylelint/stylelint/blob/9.2.1/lib/getPostcssResult.js#L13-L23
const SUPPORTED_SYNTAXES = new Set([
	'html',
	'less',
	'markdown',
	'sass',
	'sugarss',
	'scss'
]);

const LANGUAGE_EXTENSION_EXCEPTION_PAIRS = new Map([
	['javascript', 'js'],
	['javascriptreact', 'jsx'],
	['markdown', 'md'],
	['postcss', 'css'],
	['source.css.styled', 'jsx'],
	['source.markdown.math', 'md'],
	['styled-css', 'jsx'],
	['sugarss', 'sss'],
	['typescript', 'ts'],
	['typescriptreact', 'tsx'],
	['vue-html', 'vue'],
	['xml', 'xsl']
]);

const UNSUPPORTED_OPTIONS = [
	'code',
	'codeFilename',
	'files'
];

function quote(str) {
	return `\`${str}\``;
}

async function getWarnings(...args) {
	const [result] = (await lint(...args)).results;

	if (result.invalidOptionWarnings.length !== 0) {
		throw arrayToError(map(result.invalidOptionWarnings, 'text'), SyntaxError);
	}

	result.warnings = result.warnings.map(stylelintWarningToVscodeDiagnostic);

	return result;
}

async function valdiateSyntax(options) {
	// Check only CSS syntax errors without applying any stylelint rules
	return getWarnings(Object.assign({}, options, {
		config: {
			rules: {}
		}
	}));
}
module.exports = async function stylelintVSCode(...args) {
	const argLen = args.length;

	if (argLen !== 1 && argLen !== 2) {
		throw new RangeError(`Expected 1 or 2 arguments (<TextDocument>[, <Object>]), but got ${
			argLen === 0 ? 'no' : argLen
		} arguments.`);
	}

	const [textDocument, options = {}] = args;

	if (!TextDocument.is(textDocument)) {
		throw new TypeError(`Expected a TextDocument https://code.visualstudio.com/docs/extensionAPI/vscode-api#TextDocument, but got ${
			inspectWithKind(textDocument)
		}.`);
	}

	if (argLen === 2) {
		if (!isPlainObject(options)) {
			throw new TypeError(`Expected an object containing stylelint API options, but got ${
				inspectWithKind(options)
			}.`);
		}

		const providedUnsupportedOptions = intersection(Object.keys(options), UNSUPPORTED_OPTIONS);

		if (providedUnsupportedOptions.length !== 0) {
			throw new TypeError(`${
				arrayToSentence(map(UNSUPPORTED_OPTIONS, quote))
			} options are not supported because they will be derived from a document and there is no need to set them manually, but ${
				arrayToSentence(map(providedUnsupportedOptions, quote))
			} was provided.`);
		}
	}

	const codeFilename = Files.uriToFilePath(textDocument.uri);
	const exceptionalExtension = LANGUAGE_EXTENSION_EXCEPTION_PAIRS.get(textDocument.languageId);
	const baseOptions = {code: textDocument.getText()};
	let resultContainer;

	function getFallbackExt() {
		const currentExt = extname(baseOptions.codeFilename).toLowerCase().slice(1);
		const fallbackExt = exceptionalExtension || textDocument.languageId;

		if (currentExt !== fallbackExt) {
			return `.${fallbackExt}`;
		}

		return '';
	}

	async function processResults({warnings}) {
		if (warnings.length === 0) {
			return [];
		}

		const fallbackExt = getFallbackExt();

		if (fallbackExt) {
			baseOptions.codeFilename += fallbackExt;
			return (await getWarnings(Object.assign({}, options, baseOptions))).warnings;
		}

		return warnings;
	}

	baseOptions.codeFilename = codeFilename || `${last(textDocument.uri.split(':'))}.${exceptionalExtension || textDocument.languageId}`;

	if (SUPPORTED_SYNTAXES.has(textDocument.languageId)) {
		options.syntax = textDocument.languageId;
	}

	try {
		resultContainer = await getWarnings(Object.assign({}, options, baseOptions));
	} catch (err) {
		baseOptions.codeFilename += getFallbackExt();

		if (
			err.message.startsWith('No configuration provided for') ||
			err.message.includes('No rules found within configuration')
		) {
			return processResults(await valdiateSyntax(Object.assign({}, options, baseOptions)));
		}

		if (err.code === 'MODULE_NOT_FOUND') {
			return processResults(await getWarnings(Object.assign({}, options, baseOptions)));
		}

		throw err;
	}

	return processResults(resultContainer);
};
