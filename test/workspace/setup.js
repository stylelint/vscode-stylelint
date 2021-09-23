'use strict';

const pWaitFor = require('p-wait-for');

const { extensions } = require('vscode');

global.beforeAll(async () => {
	const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

	await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });
});
