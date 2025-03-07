import * as assert from 'node:assert/strict';
import { EOL } from 'node:os';
import * as semver from 'semver';

import { workspace, Selection, Position } from 'vscode';

import {
	assertCommand,
	assertTextEdits,
	waitForDiagnostics,
	openDocument,
	closeAllEditors,
	restoreFile,
	setupSettings,
	getCodeActions,
} from '../helpers';

const cssPath = 'code-actions/test.css';
const cssFoeEditInfoPath = 'code-actions/edit-info.css';
const jsPath = 'code-actions/test.js';

describe('Code actions', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	restoreFile(cssPath);
	restoreFile(jsPath);

	it('should provide code actions for problems', async () => {
		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		const actions = await getCodeActions(editor, new Selection(3, 11, 3, 11));

		assert.equal(actions.length, 3);
		assertTextEdits(actions[0].edit?.get(editor.document.uri), [
			{
				newText: `  /* stylelint-disable-next-line color-no-invalid-hex */${EOL}`,
				range: [3, 0, 3, 0],
			},
		]);
		assertTextEdits(actions[1].edit?.get(editor.document.uri), [
			{
				newText: `/* stylelint-disable color-no-invalid-hex */${EOL}`,
				range: [0, 0, 0, 0],
			},
		]);
		assertCommand(actions[2].command, {
			title: 'Open documentation for color-no-invalid-hex',
			command: 'stylelint.openRuleDoc',
			arguments: [{ uri: 'https://stylelint.io/user-guide/rules/color-no-invalid-hex' }],
		});
	});

	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const hasEditInfo = semver.satisfies(require('stylelint/package.json').version, '>=16.15');

	// Rules with EditInfo are only available in Stylelint 16.15 and later.
	const ifItHaveProblemEditsIt = hasEditInfo ? it : it.skip;

	ifItHaveProblemEditsIt('should provide code actions for problem edit info', async () => {
		const editor = await openDocument(cssFoeEditInfoPath);

		await waitForDiagnostics(editor);

		const actions = await getCodeActions(editor, new Selection(1, 11, 1, 11));

		assert.equal(actions.length, 4);
		const editAction = actions[0];

		assert.equal(editAction.title, 'Fix this color-hex-length problem');
		assertTextEdits(editAction.edit?.get(editor.document.uri), [
			{
				newText: '0000',
				range: [1, 12, 1, 13],
			},
		]);
		assertTextEdits(actions[1].edit?.get(editor.document.uri), [
			{
				newText: `  /* stylelint-disable-next-line color-hex-length */${EOL}`,
				range: [1, 0, 1, 0],
			},
		]);
		assertTextEdits(actions[2].edit?.get(editor.document.uri), [
			{
				newText: `/* stylelint-disable color-hex-length */${EOL}`,
				range: [0, 0, 0, 0],
			},
		]);
		assertCommand(actions[3].command, {
			title: 'Open documentation for color-hex-length',
			command: 'stylelint.openRuleDoc',
			arguments: [{ uri: 'https://stylelint.io/user-guide/rules/color-hex-length' }],
		});
	});

	it('should not provide disable code actions for disable reports', async () => {
		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		const actions = await getCodeActions(editor, new Selection(2, 2, 2, 2));

		assert.equal(actions.length, 0);
	});

	it('should run auto-fix action on save', async () => {
		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		// API won't save unless we dirty the document, unlike saving via the UI
		await editor.edit((editBuilder) => {
			editBuilder.insert(new Position(3, 0), ' ');
		});

		await editor.document.save();

		assert.equal(
			editor.document.getText(),
			`a {
  display: block;
  /* stylelint-disable-next-line comment-no-empty */
   color: #00;
}
`,
		);
	});

	it('should disable rules for an entire file', async () => {
		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		const actions = await getCodeActions(editor, new Selection(1, 11, 1, 11));

		const fileAction = actions.find((action) =>
			action.title.match(/^Disable .+ for the entire file$/),
		);

		assert.ok(fileAction?.edit);

		await workspace.applyEdit(fileAction.edit);

		assert.equal(
			editor.document.getText(),
			`/* stylelint-disable value-keyword-case */
a {
  display: BLOCK;
  /* stylelint-disable-next-line comment-no-empty */
  color: #00;
}
`,
		);
	});

	it('should disable rules for an entire file with a shebang', async () => {
		const editor = await openDocument(jsPath);

		await waitForDiagnostics(editor);

		const actions = await getCodeActions(editor, new Selection(6, 9, 6, 9));

		const fileAction = actions.find((action) =>
			action.title.match(/^Disable .+ for the entire file$/),
		);

		assert.ok(fileAction?.edit);

		await workspace.applyEdit(fileAction.edit);

		assert.equal(
			editor.document.getText(),
			`#!/usr/bin/env node
/* stylelint-disable color-no-invalid-hex */
/* eslint-disable node/shebang */
'use strict';

const css = css\`
	.foo {
		color: #00;
	}
\`;
`,
		);
	});

	it('should disable rules for a specific line with a comment on the previous line', async () => {
		const editor = await openDocument(cssPath);

		await waitForDiagnostics(editor);

		const actions = await getCodeActions(editor, new Selection(1, 11, 1, 11));
		const lineAction = actions.find((action) => action.title.match(/^Disable .+ for this line$/));

		assert.ok(lineAction?.edit);

		await workspace.applyEdit(lineAction.edit);

		assert.equal(
			editor.document.getText(),
			`a {
  /* stylelint-disable-next-line value-keyword-case */
  display: BLOCK;
  /* stylelint-disable-next-line comment-no-empty */
  color: #00;
}
`,
		);
	});

	context('when "stylelint.codeAction.disableRuleComment" is set to "sameLine"', () => {
		setupSettings({ 'stylelint.codeAction.disableRuleComment': { location: 'sameLine' } });

		it('should disable rules for a specific line with a comment on the same line', async () => {
			const editor = await openDocument(cssPath);

			await waitForDiagnostics(editor);

			const actions = await getCodeActions(editor, new Selection(1, 12, 1, 12));
			const lineAction = actions.find((action) => action.title.match(/^Disable .+ for this line$/));

			assert.ok(lineAction?.edit);

			await workspace.applyEdit(lineAction.edit);

			assert.equal(
				editor.document.getText(),
				`a {
  display: BLOCK; /* stylelint-disable-line value-keyword-case */
  /* stylelint-disable-next-line comment-no-empty */
  color: #00;
}
`,
			);
		});
	});

	it('should be fixed to correct position with a quick fix provided by EditInfo', async () => {
		const editor = await openDocument(cssFoeEditInfoPath);

		await waitForDiagnostics(editor);

		const actions = await getCodeActions(editor, new Selection(1, 11, 1, 11));
		const quickFixAction = actions.find((action) => action.title.match(/^Fix this .+ problem$/));

		assert.ok(quickFixAction?.edit);

		await workspace.applyEdit(quickFixAction.edit);

		assert.equal(
			editor.document.getText(),
			`a {
  color: #000000;
}
`,
		);
	});
});
