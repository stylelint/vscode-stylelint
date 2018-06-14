'use strict';

const arrayToError = require('array-to-error');
const arrayToSentence = require('array-to-sentence');
const {intersection, isPlainObject, map} = require('lodash');
const inspectWithKind = require('inspect-with-kind');
const {lint} = require('stylelint');
const {TextDocument, Files} = require('vscode-languageserver');
const stylelintWarningToVscodeDiagnostic = require('stylelint-warning-to-vscode-diagnostic');

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
	}

	try {
		resultContainer = await lint(Object.assign({}, options, baseOptions));
	} catch (err) {
		if (
			err.message.startsWith('No configuration provided for') ||
			/No rules found within configuration/.test(err.message)
		) {
			// Check only CSS syntax errors without applying any stylelint rules
			return processResults(await lint(Object.assign({}, options, baseOptions, {
				config: {
					rules: {}
				}
			})));
		}

		throw err;
	}

	return processResults(resultContainer);
};
