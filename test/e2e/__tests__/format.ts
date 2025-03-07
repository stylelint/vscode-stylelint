import * as assert from 'node:assert/strict';
import * as semver from 'semver';

import { commands } from 'vscode';

import { openDocument, closeAllEditors, setupSettings, sleep } from '../helpers';

describe('Document formatting', () => {
	setupSettings({ '[css]': { 'editor.defaultFormatter': 'stylelint.vscode-stylelint' } });

	afterEach(async () => {
		await closeAllEditors();
	});

	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const isStylelint16 = semver.satisfies(require('stylelint/package.json').version, '>=16');

	// Only Stylelint before 16 had formatting related rules
	const pre16It = isStylelint16 ? it.skip : it;

	pre16It('should format document using formatting options', async () => {
		const editor = await openDocument('defaults/format.css');

		editor.options.tabSize = 4;
		editor.options.insertSpaces = false;

		await sleep(1000); // HACK: Prevent flaky test.
		await commands.executeCommand('editor.action.formatDocument');

		assert.equal(
			editor.document.getText(),
			`a {
	color: #fff;
}
`,
		);
	});
});
