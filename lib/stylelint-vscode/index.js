'use strict';

const arrayToError = require('array-to-error');
const arrayToSentence = require('array-to-sentence');
const {at, has, intersection, isPlainObject, map, stubString} = require('lodash');
const {Files, TextDocument} = require('vscode-languageserver');
const inspectWithKind = require('inspect-with-kind');
const {lint} = require('stylelint');
const stylelintWarningToVscodeDiagnostic = require('stylelint-warning-to-vscode-diagnostic');

// https://github.com/stylelint/stylelint/blob/10.0.1/lib/getPostcssResult.js#L69-L81
const SUPPORTED_SYNTAXES = new Set([
	'css-in-js',
	'html',
	'less',
	'markdown',
	'sass',
	'scss',
	'sugarss'
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

function processResults({results}) {
	// https://github.com/stylelint/stylelint/blob/10.0.1/lib/standalone.js#L114-L122
	if (results.length === 0) {
		return [];
	}

	const [{invalidOptionWarnings, warnings}] = results;

	if (invalidOptionWarnings.length !== 0) {
		throw arrayToError(map(invalidOptionWarnings, 'text'), SyntaxError);
	}

	return warnings.map(stylelintWarningToVscodeDiagnostic);
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

	const priorOptions = {
		code: textDocument.getText(),
		formatter: stubString
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
			priorOptions.config = {rules: {}};
		}
	}

	try {
		resultContainer = await lint({...options, ...priorOptions});
	} catch (err) {
		if (
			err.message.startsWith('No configuration provided for') ||
			err.message.includes('No rules found within configuration')
		) {
			// Check only CSS syntax errors without applying any stylelint rules
			return processResults(await lint({
				...options,
				...priorOptions,
				config: {
					rules: {}
				}
			}));
		}

		throw err;
	}

	return processResults(resultContainer);
};
