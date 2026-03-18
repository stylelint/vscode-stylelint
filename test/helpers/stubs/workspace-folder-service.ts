import type { Connection } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { WorkspaceFolderService } from '../../../packages/language-server/src/server/services/index.js';

export type WorkspaceFolderServiceStub = Pick<WorkspaceFolderService, 'getWorkspaceFolder'> & {
	setWorkspaceFolder(uri: string, folder: string | undefined): void;
};

export function createWorkspaceFolderStub(): WorkspaceFolderServiceStub {
	const folders = new Map<string, string | undefined>();

	return {
		async getWorkspaceFolder(_connection: Connection, document: TextDocument) {
			return folders.get(document.uri);
		},
		setWorkspaceFolder(uri: string, folder: string | undefined) {
			folders.set(uri, folder);
		},
	};
}
