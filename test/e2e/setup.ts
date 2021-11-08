import pWaitFor from 'p-wait-for';
import path from 'path';

import { extensions } from 'vscode';

global.beforeAll(async () => {
	const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

	if (!vscodeStylelint) {
		throw new Error('Unable to find Stylelint extension');
	}

	await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });
});

Object.defineProperty(global, 'workspaceDir', {
	get() {
		return path.join(__dirname, 'workspace');
	},
});
