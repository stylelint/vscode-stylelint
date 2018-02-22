'use strict';

const {inspect} = require('util');

const arrayToError = require('array-to-error');
const inspectWithKind = require('inspect-with-kind');
const isPlainObj = require('is-plain-obj');
const stylelintWarningToVscodeDiagnostic = require('stylelint-warning-to-vscode-diagnostic');
const {lint} = require('stylelint');

module.exports = function stylelintVSCode(options) {
	if (!isPlainObj(options)) {
		return Promise.reject(new TypeError(`Expected an object containing stylelint API options, but got ${
			inspectWithKind(options)
		}.`));
	}

	if (options.files) {
		return Promise.reject(new TypeError(`${inspect(options.files)
		} was passed to \`file\` option, but stylelint-vscode doesn't support \`file\` option because` +
		' it is specifically designed for Visual Studio Code API integration.' +
		' Pass the file contents derived from `TextDocument#getText()` to `code` option instead.' +
		' https://code.visualstudio.com/docs/extensionAPI/vscode-api#TextDocument'));
	}

	if (!('code' in options)) {
		return Promise.reject(new TypeError('`code` option is required but not provided.'));
	}

	if (typeof options.code !== 'string') {
		return Promise.reject(new TypeError(`\`code\` option must be a string, but received a non-string value ${
			inspectWithKind(options.code)
		}.`));
	}

	return lint(Object.assign({}, options))
	.catch(function suppressNoConfigurationFoundError(err) {
		if (
			err.message.startsWith('No configuration provided for') ||
			/No rules found within configuration/.test(err.message)
		) {
			// Check only CSS syntax errors without applying any stylelint rules
			return lint(Object.assign({}, options, {
				config: {
					rules: {}
				},
				files: null
			}));
		}

		return Promise.reject(err);
	})
	.then(({results}) => {
		const invalidOptionWarnings = results[0].invalidOptionWarnings;

		if (invalidOptionWarnings.length !== 0) {
			const texts = invalidOptionWarnings.map(warning => warning.text);
			return Promise.reject(arrayToError(texts, SyntaxError));
		}

		return results[0].warnings.map(stylelintWarningToVscodeDiagnostic);
	});
};
