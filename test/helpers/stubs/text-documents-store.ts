import { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextDocuments } from 'vscode-languageserver/node';

export type TextDocumentsStore = Pick<TextDocuments<TextDocument>, 'get' | 'all'> & {
	set(document: TextDocument): void;
};

export function createTextDocumentsStore(): TextDocumentsStore {
	const store = new Map<string, TextDocument>();

	return {
		get: (uri: string) => store.get(uri),
		all: () => [...store.values()],
		set: (document: TextDocument) => {
			store.set(document.uri, document);
		},
	};
}
