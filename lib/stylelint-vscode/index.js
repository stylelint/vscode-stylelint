'use strict';

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

	function processResults({results}) {
		const [{invalidOptionWarnings, warnings}] = results;

		if (invalidOptionWarnings.length !== 0) {
			const texts = map(invalidOptionWarnings, 'text');
			throw arrayToError(texts, SyntaxError);
		}

		if (warnings.length === 0) {
			return [];
		}

		return warnings.map(stylelintWarningToVscodeDiagnostic);
	}

	let resultContainer;

	const baseOptions = {
		code: textDocument.getText()
	};

	const codeFilename = Files.uriToFilePath(textDocument.uri);

	if (codeFilename) {
		baseOptions.codeFilename = codeFilename;
	} else {
		baseOptions.codeFilename = `${last(textDocument.uri.split(':'))}`;

		const exceptionalExtension = LANGUAGE_EXTENSION_EXCEPTION_PAIRS.get(textDocument.languageId);

		if (exceptionalExtension) {
			baseOptions.codeFilename += `.${exceptionalExtension}`;
		} else {
			baseOptions.codeFilename += `.${textDocument.languageId}`;
		}
	}

	if (SUPPORTED_SYNTAXES.has(textDocument.languageId)) {
		options.syntax = textDocument.languageId;
	}

	try {
		resultContainer = await lint(Object.assign({}, options, baseOptions));
	} catch (originalErr) {
		let error;
		} else {
		}

		if (
			error.message.startsWith('No configuration provided for') ||
			/No rules found within configuration/.test(error.message)
		) {
			// Check only CSS syntax errors without applying any stylelint rules
			return processResults(await lint(Object.assign({}, options, baseOptions, {
				config: {
					rules: {}
				}
			})));
		}

		throw error;
	}

	return processResults(resultContainer);
};
