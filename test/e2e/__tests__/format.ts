import * as assert from 'node:assert/strict';

import { commands } from 'vscode';

import { openDocument, closeAllEditors, setupSettings, sleep } from '../helpers';

describe('Document formatting', () => {
	setupSettings({ '[css]': { 'editor.defaultFormatter': 'stylelint.vscode-stylelint' } });

	afterEach(async () => {
		await closeAllEditors();
	});

	it('should format document using formatting options', async () => {
		const editor = await openDocument('defaults/format.css');

		editor.options.tabSize = 4;
		editor.options.insertSpaces = false;

		await sleep(1000); // HACK: Prevent flaky test.
		await commands.executeCommand('editor.action.formatDocument');

		assert.equal(
			editor.document.getText(),
			`a {
	color: red;
}
`,
		);
	});
});
