'use strict';

const arrayToError = require('array-to-error');
const arrayToSentence = require('array-to-sentence');
const {at, intersection, isPlainObject, map} = require('lodash');
const {Files, TextDocument} = require('vscode-languageserver');
const inspectWithKind = require('inspect-with-kind');
const {lint} = require('stylelint');
const stylelintFormatterSimplest = require('stylelint-formatter-simplest');
const stylelintWarningToVscodeDiagnostic = require('stylelint-warning-to-vscode-diagnostic');

// https://github.com/stylelint/stylelint/blob/9.5.0/lib/getPostcssResult.js#L13-L21
const SUPPORTED_SYNTAXES = new Set([
	'html',
	'less',
	'markdown',
	'sass',
	'sugarss',
	'scss'
]);

const LANGUAGE_EXTENSION_EXCEPTION_PAIRS = new Map([
	['javascript', 'jsx'],
	['javascriptreact', 'jsx'],
	['source.css.styled', 'jsx'],
	['source.markdown.math', 'markdown'],
	['styled-css', 'jsx'],
	['typescript', 'jsx'],
	['typescriptreact', 'jsx'],
	['vue-html', 'html'],
	['xml', 'html'],
	['xsl', 'html']
]);

const UNSUPPORTED_OPTIONS = [
	'code',
	'codeFilename',
	'files',
	'formatter'
];

function quote(str) {
	return `\`${str}\``;
}

module.exports = async function stylelintVSCode(...args) {
	const argLen = args.length;

	if (argLen !== 1 && argLen !== 2) {
		throw new RangeError(`Expected 1 or 2 arguments (<TextDocument>[, <Object>]), but got ${
			argLen === 0 ? 'no' : argLen
		} arguments.`);
	}

	const [textDocument, options] = args;

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

	function processResults({output, results}) {
		if (output.length === 0) {
			return [];
		}

		const [{invalidOptionWarnings, warnings}] = results;

		if (invalidOptionWarnings.length !== 0) {
			throw arrayToError(map(invalidOptionWarnings, 'text'), SyntaxError);
		}

		return warnings.map(stylelintWarningToVscodeDiagnostic);
	}

	const baseOptions = {
		code: textDocument.getText(),
		formatter: stylelintFormatterSimplest
	};
	const codeFilename = Files.uriToFilePath(textDocument.uri);
	let resultContainer;

	if (codeFilename) {
		baseOptions.codeFilename = codeFilename;
	} else {
		if (SUPPORTED_SYNTAXES.has(textDocument.languageId)) {
			baseOptions.syntax = textDocument.languageId;
		} else {
			const customSyntax = LANGUAGE_EXTENSION_EXCEPTION_PAIRS.get(textDocument.languageId);

			if (customSyntax) {
				baseOptions.customSyntax = `postcss-${customSyntax}`;
			}
		}

		if (!at(options, 'config.rules')[0]) {
			baseOptions.config = {rules: {}};
		}
	}

	try {
		resultContainer = await lint({...options, ...baseOptions});
	} catch (err) {
		if (
			err.message.startsWith('No configuration provided for') ||
			err.message.includes('No rules found within configuration')
		) {
			// Check only CSS syntax errors without applying any stylelint rules
			return processResults(await lint({
				...options,
				...baseOptions,
				config: {
					rules: {}
				}
			}));
		}

		throw err;
	}

	return processResults(resultContainer);
};
