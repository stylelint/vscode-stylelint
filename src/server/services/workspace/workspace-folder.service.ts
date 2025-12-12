import { URI } from 'vscode-uri';
import type { Connection } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { normalizeFsPath } from '../../utils/index.js';
import { inject } from '../../../di/index.js';
import { NormalizeFsPathToken, PathIsInsideToken, UriModuleToken } from '../../tokens.js';

type PathIsInside = (path: string, potentialParent: string) => boolean;

@inject({
	inject: [PathIsInsideToken, UriModuleToken, NormalizeFsPathToken],
})
export class WorkspaceFolderService {
	readonly #pathIsInside: PathIsInside;
	readonly #uri: typeof URI;
	readonly #normalizeFsPath: typeof normalizeFsPath;

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
			const uri = (await connection.workspace.getWorkspaceFolders())?.[0]?.uri;

			return uri ? this.#uri.parse(uri).fsPath : undefined;
		}

		if (!fsPath) {
			return undefined;
		}

		const normalizedDocumentPath = this.#normalizeFsPath(fsPath);

		if (!normalizedDocumentPath) {
			return undefined;
		}

		const workspaceFolders = await connection.workspace.getWorkspaceFolders();

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
}
