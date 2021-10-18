'use strict';

const pathIsInside = require('path-is-inside');
const { URI } = require('vscode-uri');

/**
 * Gets the workspace folder for a given document.
 * @param {lsp.Connection} connection The language server connection to use to
 * get available workspace folders.
 * @param {lsp.TextDocument} document The document to get the workspace folder for.
 * @returns {Promise<string | undefined>}
 */
async function getWorkspaceFolder(connection, document) {
	const documentPath = URI.parse(document.uri).fsPath;

	if (documentPath) {
		const workspaceFolders = await connection.workspace.getWorkspaceFolders();

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

module.exports = {
	getWorkspaceFolder,
};
