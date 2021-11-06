import diff from 'fast-diff';
import { Range, TextEdit } from 'vscode-languageserver-types';
import { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Creates text edits for a document given updated contents. Allows for
 * retaining the cursor position when the document is updated.
 * @param document The document to create text edits for.
 * @param newContents The new contents of the document.
 * @returns The text edits to apply to the document.
 */
export function createTextEdits(document: TextDocument, newContents: string): TextEdit[] {
	const diffs = diff(document.getText(), newContents);

	const edits = [];
	let offset = 0;

	for (const [op, text] of diffs) {
		const start = offset;

		switch (op) {
			case diff.EQUAL:
				offset += text.length;
				break;
			case diff.DELETE:
				offset += text.length;
				edits.push(
					TextEdit.del(Range.create(document.positionAt(start), document.positionAt(offset))),
				);
				break;
			case diff.INSERT:
				edits.push(TextEdit.insert(document.positionAt(start), text));
				break;
		}
	}

	return edits;
}
