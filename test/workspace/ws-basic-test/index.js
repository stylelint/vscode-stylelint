'use strict';

const path = require('path');

const { workspace } = require('vscode');

describe('vscode-stylelint', () => {
	it('should add syntax highlighting to .stylelintignore', async () => {
		expect(
			(await workspace.openTextDocument(path.join(__dirname, '.stylelintignore'))).languageId,
		).toBe('ignore');
	});
});
