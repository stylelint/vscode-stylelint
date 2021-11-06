import pathIsInside from 'path-is-inside';
import { URI } from 'vscode-uri';
import type { Connection } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Gets the workspace folder for a given document. If the document is an
 * untitled file, then the first open workspace folder is returned.
 * @param connection The language server connection to use to
 * get available workspace folders.
 * @param document The document to get the workspace folder for.
 */
export async function getWorkspaceFolder(
	connection: Connection,
	document: TextDocument,
): Promise<string | undefined> {
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
