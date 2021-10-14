'use strict';

const pathIsInside = require('path-is-inside');
const { URI } = require('vscode-uri');

/**
 * @param {lsp.TextDocument} document
 * @param {lsp.Connection} [connection]
 * @returns {Promise<string | undefined>}
 */
async function getWorkspaceFolder(document, connection) {
	const documentPath = URI.parse(document.uri).fsPath;

	if (documentPath) {
		const workspaceFolders = await connection?.workspace.getWorkspaceFolders();

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
