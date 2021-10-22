'use strict';

const pathIsInside = require('path-is-inside');
const { URI } = require('vscode-uri');

/**
 * Gets the workspace folder for a given document. If the document is an
 * untitled file, then the first open workspace folder is returned.
 * @param {lsp.Connection} connection The language server connection to use to
 * get available workspace folders.
 * @param {lsp.TextDocument} document The document to get the workspace folder for.
 * @returns {Promise<string | undefined>}
 */
async function getWorkspaceFolder(connection, document) {
	const { scheme, fsPath } = URI.parse(document.uri);

	if (scheme === 'untitled') {
		const uri = (await connection.workspace.getWorkspaceFolders())?.[0]?.uri;

		return uri ? URI.parse(uri).fsPath : undefined;
	}

	if (fsPath) {
		const workspaceFolders = await connection.workspace.getWorkspaceFolders();

		if (workspaceFolders) {
			for (const { uri } of workspaceFolders) {
				const workspacePath = URI.parse(uri).fsPath;

				if (pathIsInside(fsPath, workspacePath)) {
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
