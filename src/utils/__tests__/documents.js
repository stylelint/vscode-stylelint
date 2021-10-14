'use strict';

jest.mock('path');

const mockPath = /** @type {tests.mocks.PathModule} */ (require('path'));

mockPath.__mockPlatform('posix');

jest.mock('vscode-uri', () => ({
	URI: {
		parse: jest.fn((/** @type {string} */ str) => ({ fsPath: str })),
	},
}));

const { getWorkspaceFolder } = require('../documents');

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
	test("should return a document's workspace folder when one is applicable", async () => {
		const connection = createMockConnection(['/home/user/directory', '/home/user/project']);
		const document = createMockTextDocument('/home/user/project/file.js');

		expect(await getWorkspaceFolder(document, connection)).toBe('/home/user/project');
	});

	test('should return undefined when no workspace folder is applicable', async () => {
		const connection = createMockConnection(['/home/user/directory']);
		const document = createMockTextDocument('/home/user/file.js');

		expect(await getWorkspaceFolder(document, connection)).toBeUndefined();
	});

	test('should return undefined when no workspace folders are returned by the connection', async () => {
		const connection = createMockConnection();
		const document = createMockTextDocument('/home/user/file.js');

		expect(await getWorkspaceFolder(document, connection)).toBeUndefined();
	});

	test('should return undefined when the document has no FS path', async () => {
		const connection = createMockConnection(['/home/user/project']);
		const document = createMockTextDocument('');

		expect(await getWorkspaceFolder(document, connection)).toBeUndefined();
	});
});
