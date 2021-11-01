'use strict';

const path = require('path');

// const pWaitFor = require('p-wait-for');
// const { window, workspace } = require('vscode');
const { workspace } = require('vscode');

// const { normalizeDiagnostic, getStylelintDiagnostics } = require('../utils');

const workspaceDir = path.join(__dirname, 'workspace');

describe('.stylelintignore', () => {
	it('should have syntax highlighting', async () => {
		expect(
			(await workspace.openTextDocument(path.join(workspaceDir, '.stylelintignore'))).languageId,
		).toBe('ignore');
	});

	// TODO: Get .stylelintignore to work
	// eslint-disable-next-line jest/no-commented-out-tests
	// it('should be respected', async () => {
	// 	const cssDocument = await workspace.openTextDocument(path.resolve(workspaceDir, 'ignored.css'));

	// 	await window.showTextDocument(cssDocument);

	// 	await pWaitFor(() => getStylelintDiagnostics(cssDocument.uri).length > 0, { timeout: 5000 });

	// 	expect(getStylelintDiagnostics(cssDocument.uri).map(normalizeDiagnostic)).toEqual([]);
	// });
});
