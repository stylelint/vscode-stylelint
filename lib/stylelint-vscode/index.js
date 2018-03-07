'use strict';

const {inspect} = require('util');

const arrayToError = require('array-to-error');
const inspectWithKind = require('inspect-with-kind');
const isPlainObj = require('is-plain-obj');
const {map} = require('lodash');
const stylelintWarningToVscodeDiagnostic = require('stylelint-warning-to-vscode-diagnostic');
const {lint} = require('stylelint');

module.exports = async function stylelintVSCode(...args) {
	const argLen = args.length;

	if (argLen !== 1) {
		throw new RangeError(`Expected 1 argument (<Object>), but got ${
			argLen === 0 ? 'no' : argLen
		} arguments.`);
	}

	const [options] = args;

	if (!isPlainObj(options)) {
		throw new TypeError(`Expected an object containing stylelint API options, but got ${
			inspectWithKind(options)
		}.`);
	}

	if (options.files) {
		throw new TypeError(`${
			inspect(options.files)
		} was passed to \`file\` option, but stylelint-vscode doesn't support \`file\` option because` +
		' it is specifically designed for Visual Studio Code API integration.' +
		' Pass the file contents derived from `TextDocument#getText()` to `code` option instead.' +
		' https://code.visualstudio.com/docs/extensionAPI/vscode-api#TextDocument');
	}

	if (!('code' in options)) {
		throw new TypeError('`code` option is required but not provided.');
	}

	if (typeof options.code !== 'string') {
		throw new TypeError(`\`code\` option must be a string, but received a non-string value ${
			inspectWithKind(options.code)
		}.`);
	}

	function processResults({results}) {
		const [{invalidOptionWarnings, warnings}] = results;

		if (invalidOptionWarnings.length !== 0) {
			const texts = map(invalidOptionWarnings, 'text');
			throw arrayToError(texts, SyntaxError);
		}

		return warnings.map(stylelintWarningToVscodeDiagnostic);
	}

	let resultContainer;

	try {
		resultContainer = await lint(Object.assign({}, options));
	} catch (err) {
		if (
			err.message.startsWith('No configuration provided for') ||
			/No rules found within configuration/.test(err.message)
		) {
			// Check only CSS syntax errors without applying any stylelint rules
			return processResults(await lint(Object.assign({}, options, {
				config: {
					rules: {}
				}
			})));
		}

		throw err;
	}

	return processResults(resultContainer);
};
