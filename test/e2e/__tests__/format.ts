import path from 'path';
import { commands } from 'vscode';
import { URI } from 'vscode-uri';
import { ApiEvent } from '../../../src/extension/index';

describe('Document formatting', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const isStylelint16 = require('stylelint/package.json').version.startsWith('16.');

	// Only Stylelint before 16 had formatting related rules
	const pre16It = isStylelint16 ? it.skip : it;

	pre16It('should format document using formatting options', async () => {
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

		// eslint-disable-next-line jest/no-standalone-expect
		expect(editor.document.getText()).toMatchSnapshot();
	});
});
