jest.mock('path');

jest.mock('vscode-uri', () => ({
	URI: {
		parse: jest.fn((str: string) => ({
			fsPath: str,
			scheme: str.startsWith('untitled') ? 'untitled' : 'file',
		})),
	},
}));

import path from 'path';
import type { Connection } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

const mockPath = path as tests.mocks.PathModule;

mockPath.__mockPlatform('posix');

import { getWorkspaceFolder } from '../get-workspace-folder';

const createMockConnection = (workspaceFolders?: string[]) => {
	const folders = workspaceFolders && workspaceFolders.map((folder) => ({ uri: folder }));

	return {
		workspace: {
			getWorkspaceFolders: async () => folders,
		},
	} as Connection;
};

const createMockTextDocument = (uri: string) => ({ uri }) as TextDocument;

describe('getWorkspaceFolder', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("when one is applicable, should return a document's workspace folder", async () => {
		const connection = createMockConnection(['/home/user/directory', '/home/user/project']);
		const document = createMockTextDocument('/home/user/project/file.js');

		expect(await getWorkspaceFolder(connection, document)).toBe('/home/user/project');
	});

	test('when no workspace folder is applicable, should return undefined', async () => {
		const connection = createMockConnection(['/home/user/directory']);
		const document = createMockTextDocument('/home/user/file.js');

		expect(await getWorkspaceFolder(connection, document)).toBeUndefined();
	});

	test('when no workspace folders are returned by the connection, should return undefined', async () => {
		const connection = createMockConnection();
		const document = createMockTextDocument('/home/user/file.js');

		expect(await getWorkspaceFolder(connection, document)).toBeUndefined();
	});

	test('when the document has no FS path, should return undefined', async () => {
		const connection = createMockConnection(['/home/user/project']);
		const document = createMockTextDocument('');

		expect(await getWorkspaceFolder(connection, document)).toBeUndefined();
	});

	test('when given an untitled document and a workspace is open, should return the first workspace folder', async () => {
		const connection = createMockConnection(['/home/user/directory', '/home/user/project']);
		const document = createMockTextDocument('untitled:Untitled-1');

		expect(await getWorkspaceFolder(connection, document)).toBe('/home/user/directory');
	});

	test('when given an untitled document and no workspace is open, should return undefined', async () => {
		const connection = createMockConnection();
		const document = createMockTextDocument('untitled:Untitled-1');

		expect(await getWorkspaceFolder(connection, document)).toBeUndefined();
	});
});
