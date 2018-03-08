'use strict';

const {inspect} = require('util');
const {extname, join} = require('path');

const arrayToError = require('array-to-error');
const {attempt, isPlainObject, map, toLower} = require('lodash');
const augmentConfig = require('stylelint/lib/augmentConfig.js');
const inspectWithKind = require('inspect-with-kind');
const stylelintWarningToVscodeDiagnostic = require('stylelint-warning-to-vscode-diagnostic');

const CSS_IN_JS_PROCESSOR_NAMES = new Set([
	'stylelint-processor-glamorous',
	'stylelint-processor-styled-components'
]);
const jsSymbol = Symbol('jsProcessorEnabled');

const JS_EXTERNSIONS = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const JS_LANGUAGE_IDS = new Set([
	'javascript',
	'javascriptreact',
	'source.css.styled',
	'styled-css',
	'typescript',
	'typescriptreact'
]);

function addSymbol(stylelintResult) {
	stylelintResult[jsSymbol] = true;
	return stylelintResult;
}

const originalAugmentConfigFull = augmentConfig.augmentConfigFull;

augmentConfig.augmentConfigFull = async (stylelint, ...restArgs) => {
	const result = await originalAugmentConfigFull(stylelint, ...restArgs);

	if (!result) {
		return result;
	}

	const {processors} = result.config;

	if (!Array.isArray(processors)) {
		return result;
	}

	for (const processorPath of processors) {
		for (const cssInJsProcessorName of CSS_IN_JS_PROCESSOR_NAMES) {
			const lastIndex = processorPath.lastIndexOf(cssInJsProcessorName);

			if (lastIndex === -1) {
				continue;
			}

			const processorDirPath = processorPath.slice(0, lastIndex + cssInJsProcessorName.length);
			const {name} = attempt(require, join(processorDirPath, 'package.json'));

			if (name !== cssInJsProcessorName) {
				continue;
			}

			const originalGetConfigForFile = stylelint.getConfigForFile;

			stylelint.getConfigForFile = async (...args) => {
				stylelint.getConfigForFile = originalGetConfigForFile;

				const perFileConfig = await originalGetConfigForFile(...args);
				perFileConfig.config.resultProcessors.push(addSymbol);

				return perFileConfig;
			};

			return result;
		}
	}

	return result;
};

const {lint} = require('stylelint');

module.exports = async function stylelintVSCode(...args) {
	const argLen = args.length;

	if (argLen !== 1) {
		throw new RangeError(`Expected 1 argument (<Object>), but got ${
			argLen === 0 ? 'no' : argLen
		} arguments.`);
	}

	const [options] = args;

	if (!isPlainObject(options)) {
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
		const [{invalidOptionWarnings, warnings, [jsSymbol]: jsProcessorEnabled}] = results;

		if (invalidOptionWarnings.length !== 0) {
			const texts = map(invalidOptionWarnings, 'text');
			throw arrayToError(texts, SyntaxError);
		}

		if (warnings.length === 0) {
			return [];
		}

		if (!jsProcessorEnabled && (
			JS_EXTERNSIONS.has(extname(toLower(options.codeFilename))) ||
			JS_LANGUAGE_IDS.has(options.languageId)
		)) {
			return [];
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
