import { URI } from 'vscode-uri';
import type { Connection, WorkspaceFolder } from 'vscode-languageserver';
import { DidChangeWorkspaceFoldersNotification } from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { normalizeFsPath } from '../../utils/index.js';
import { inject } from '../../../di/index.js';
import { lspService, notification } from '../../decorators.js';
import { NormalizeFsPathToken, PathIsInsideToken, UriModuleToken } from '../../tokens.js';

type PathIsInside = (path: string, potentialParent: string) => boolean;

@lspService()
@inject({
	inject: [PathIsInsideToken, UriModuleToken, NormalizeFsPathToken],
})
export class WorkspaceFolderService {
	readonly #pathIsInside: PathIsInside;
	readonly #uri: typeof URI;
	readonly #normalizeFsPath: typeof normalizeFsPath;
	#cachedFolders: WorkspaceFolder[] | undefined;

	constructor(
		pathIsInsideFn: PathIsInside,
		uriModule: typeof URI,
		normalizeFsPathFn: typeof normalizeFsPath,
	) {
		this.#pathIsInside = pathIsInsideFn;
		this.#uri = uriModule;
		this.#normalizeFsPath = normalizeFsPathFn;
	}

	/**
	 * Clears the cached workspace folders when the set of workspace folders
	 * changes.
	 */
	@notification(DidChangeWorkspaceFoldersNotification.type)
	clearCache(): void {
		this.#cachedFolders = undefined;
	}

	/**
	 * Gets the workspace folder for a given document. If the document is an
	 * untitled file, then the first open workspace folder is returned.
	 * @param connection The language server connection to use to get available
	 * workspace folders.
	 * @param document The document to get the workspace folder for.
	 */
	async getWorkspaceFolder(
		connection: Connection,
		document: TextDocument,
	): Promise<string | undefined> {
		const { scheme, fsPath } = this.#uri.parse(document.uri);

		if (scheme === 'untitled') {
			const folders = await this.#getWorkspaceFolders(connection);
			const uri = folders?.[0]?.uri;

			return uri ? this.#uri.parse(uri).fsPath : undefined;
		}

		if (!fsPath) {
			return undefined;
		}

		const normalizedDocumentPath = this.#normalizeFsPath(fsPath);

		if (!normalizedDocumentPath) {
			return undefined;
		}

		const workspaceFolders = await this.#getWorkspaceFolders(connection);

		if (!workspaceFolders) {
			return undefined;
		}

		for (const { uri } of workspaceFolders) {
			const workspacePath = this.#uri.parse(uri).fsPath;
			const normalizedWorkspacePath = this.#normalizeFsPath(workspacePath);

			if (!normalizedWorkspacePath) {
				continue;
			}

			if (this.#pathIsInside(normalizedDocumentPath, normalizedWorkspacePath)) {
				return workspacePath;
			}
		}

		return undefined;
	}

	async #getWorkspaceFolders(connection: Connection): Promise<WorkspaceFolder[] | null> {
		if (this.#cachedFolders !== undefined) {
			return this.#cachedFolders;
		}

		const folders = await connection.workspace.getWorkspaceFolders();

		this.#cachedFolders = folders ?? [];

		return this.#cachedFolders;
	}
}
