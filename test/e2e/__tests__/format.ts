import path from 'path';
import { commands } from 'vscode';
import { URI } from 'vscode-uri';
import { ApiEvent } from '../../../src/extension/index';

describe('Document formatting', () => {
	it('should format document using formatting options', async () => {
		const documentPath = path.resolve(workspaceDir, 'defaults/format.css');

		const eventPromise = waitForApiEvent(
			ApiEvent.DidRegisterDocumentFormattingEditProvider,
			({ uri }) => path.relative(documentPath, URI.parse(uri).fsPath) === '',
		);

		const editor = await openDocument(documentPath);

		await eventPromise;

		editor.options.tabSize = 4;
		editor.options.insertSpaces = false;

		await commands.executeCommand('editor.action.formatDocument');

		expect(editor.document.getText()).toMatchSnapshot();
	});
});
