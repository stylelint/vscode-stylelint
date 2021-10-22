'use strict';

jest.mock('path');

const mockPath = /** @type {tests.mocks.PathModule} */ (require('path'));

mockPath.__mockPlatform('posix');

jest.mock('vscode-uri', () => ({
	URI: {
		parse: jest.fn((/** @type {string} */ str) => ({
			fsPath: str,
			scheme: str.startsWith('untitled') ? 'untitled' : 'file',
		})),
	},
}));

const { getWorkspaceFolder } = require('../get-workspace-folder');

/**
 * @param {string[] | null} [workspaceFolders]
 * @returns {lsp.Connection}
 */
const createMockConnection = (workspaceFolders) => {
	const folders = workspaceFolders && workspaceFolders.map((folder) => ({ uri: folder }));

	return /** @type {any} */ ({
		workspace: {
			getWorkspaceFolders: async () => folders,
		},
	});
};

/**
 * @param {string} uri
 * @returns {lsp.TextDocument}
 */
const createMockTextDocument = (uri) => /** @type {any} */ ({ uri });

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
