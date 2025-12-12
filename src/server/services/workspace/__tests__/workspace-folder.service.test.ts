import { describe, expect, test } from 'vitest';
import type { Connection } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { NormalizeFsPathToken, PathIsInsideToken, UriModuleToken } from '../../../tokens.js';
import { WorkspaceFolderService } from '../workspace-folder.service';

const createMockConnection = (workspaceFolders?: string[]) => {
	const folders = workspaceFolders && workspaceFolders.map((folder) => ({ uri: folder }));

	return {
		workspace: {
			getWorkspaceFolders: async () => folders,
		},
	} as Connection;
};

const createMockTextDocument = (uri: string) => ({ uri }) as TextDocument;

class FakeURI {
	static parse(str: string) {
		const scheme = str.startsWith('untitled') ? 'untitled' : 'file';

		return {
			scheme,
			fsPath: scheme === 'untitled' ? '' : str,
		};
	}
}

const pathIsInside = (target: string, parent: string): boolean => target.startsWith(parent);
const uriModule = FakeURI as unknown as typeof import('vscode-uri').URI;
const normalizeFsPath = (value: string | undefined) => value ?? undefined;

const createResolver = () => {
	const container = createContainer(
		module({
			register: [
				provideTestValue(PathIsInsideToken, () => pathIsInside),
				provideTestValue(UriModuleToken, () => uriModule),
				provideTestValue(NormalizeFsPathToken, () => normalizeFsPath),
				WorkspaceFolderService,
			],
		}),
	);

	return container.resolve(WorkspaceFolderService);
};

describe('WorkspaceFolderResolver', () => {
	test("when one is applicable, should return a document's workspace folder", async () => {
		const resolver = createResolver();
		const connection = createMockConnection(['/home/user/directory', '/home/user/project']);
		const document = createMockTextDocument('/home/user/project/file.js');

		expect(await resolver.getWorkspaceFolder(connection, document)).toBe('/home/user/project');
	});

	test('when no workspace folder is applicable, should return undefined', async () => {
		const resolver = createResolver();
		const connection = createMockConnection(['/home/user/directory']);
		const document = createMockTextDocument('/home/user/file.js');

		expect(await resolver.getWorkspaceFolder(connection, document)).toBeUndefined();
	});

	test('when no workspace folders are returned by the connection, should return undefined', async () => {
		const resolver = createResolver();
		const connection = createMockConnection();
		const document = createMockTextDocument('/home/user/file.js');

		expect(await resolver.getWorkspaceFolder(connection, document)).toBeUndefined();
	});

	test('when the document has no FS path, should return undefined', async () => {
		const resolver = createResolver();
		const connection = createMockConnection(['/home/user/project']);
		const document = createMockTextDocument('');

		expect(await resolver.getWorkspaceFolder(connection, document)).toBeUndefined();
	});

	test('when given an untitled document and a workspace is open, should return the first workspace folder', async () => {
		const resolver = createResolver();
		const connection = createMockConnection(['/home/user/directory', '/home/user/project']);
		const document = createMockTextDocument('untitled:Untitled-1');

		expect(await resolver.getWorkspaceFolder(connection, document)).toBe('/home/user/directory');
	});

	test('when given an untitled document and no workspace is open, should return undefined', async () => {
		const resolver = createResolver();
		const connection = createMockConnection();
		const document = createMockTextDocument('untitled:Untitled-1');

		expect(await resolver.getWorkspaceFolder(connection, document)).toBeUndefined();
	});
});
