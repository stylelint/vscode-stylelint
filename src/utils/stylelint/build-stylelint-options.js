'use strict';

const path = require('path');
const pathIsInside = require('path-is-inside');
const { URI } = require('vscode-uri');
const { findPackageRoot } = require('../packages');

/**
 * Given a document URI, base options, and extension options, builds a Stylelint
 * options object. Extension options supersede base options.
 * @param {string} uri
 * @param {string} [workspaceFolder]
 * @param {Partial<stylelint.LinterOptions>} [baseOptions]
 * @param {ExtensionOptions} [extensionOptions]
 * @returns {Promise<Partial<stylelint.LinterOptions>>}
 */
async function buildStylelintOptions(
	uri,
	workspaceFolder,
	baseOptions = {},
	{
		config,
		configFile,
		configBasedir,
		customSyntax,
		ignoreDisables,
		reportNeedlessDisables,
		reportInvalidScopeDisables,
	} = {},
) {
	const options = {
		...baseOptions,

		config: config ?? baseOptions.config,

		configFile: configFile
			? workspaceFolder
				? configFile.replace(/\$\{workspaceFolder\}/gu, workspaceFolder)
				: configFile
			: baseOptions.configFile,

		configBasedir: configBasedir
			? path.isAbsolute(configBasedir)
				? configBasedir
				: path.join(workspaceFolder ?? '', configBasedir)
			: baseOptions.configBasedir,

		customSyntax: customSyntax
			? workspaceFolder
				? customSyntax.replace(/\$\{workspaceFolder\}/gu, workspaceFolder)
				: customSyntax
			: baseOptions.customSyntax,

		ignoreDisables: ignoreDisables ?? baseOptions.ignoreDisables,

		reportNeedlessDisables: reportNeedlessDisables ?? baseOptions.reportNeedlessDisables,

		reportInvalidScopeDisables:
			reportInvalidScopeDisables ?? baseOptions.reportInvalidScopeDisables,
	};

	const documentPath = URI.parse(uri).fsPath;

	if (documentPath) {
		if (workspaceFolder && pathIsInside(documentPath, workspaceFolder)) {
			options.ignorePath = path.join(workspaceFolder, '.stylelintignore');
		}

		if (options.ignorePath === undefined) {
			options.ignorePath = path.join(
				(await findPackageRoot(documentPath)) || path.parse(documentPath).root,
				'.stylelintignore',
			);
		}
	}

	return options;
}

module.exports = {
	buildStylelintOptions,
};
