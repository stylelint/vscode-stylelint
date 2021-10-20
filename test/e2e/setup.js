'use strict';

const pWaitFor = require('p-wait-for');

const { extensions } = require('vscode');

global.beforeAll(async () => {
	const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

	if (!vscodeStylelint) {
		throw new Error('Unable to find stylelint extension');
	}

	await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });
});
