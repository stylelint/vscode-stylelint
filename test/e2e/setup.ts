import pWaitFor from 'p-wait-for';
import path from 'path';

import {
	commands,
	extensions,
	window,
	workspace,
	TextEditor,
	TextDocument,
	Diagnostic,
} from 'vscode';
import type { ExtensionEvents, PublicApi } from '../../src/extension/index';
import { getStylelintDiagnostics } from './utils';

Object.defineProperty(global, 'workspaceDir', {
	get() {
		return path.join(__dirname, 'workspace');
	},
});

const openEditors: TextEditor[] = [];

Object.defineProperty(global, 'openDocument', {
	get() {
		return async (fsPath: string) => {
			const document = await workspace.openTextDocument(fsPath);
			const editor = await window.showTextDocument(document);

			openEditors.push(editor);

			return editor;
		};
	},
});

Object.defineProperty(global, 'waitForDiagnostics', {
	get() {
		return (
			editorOrDocument: TextEditor | TextDocument,
			timeout = 5000,
			interval = 20,
		): Promise<Diagnostic[]> => {
			const uri =
				(editorOrDocument as TextEditor)?.document?.uri ?? (editorOrDocument as TextDocument).uri;

			return new Promise((resolve, reject) => {
				// eslint-disable-next-line prefer-const
				let timeoutRef: NodeJS.Timeout;

				const intervalRef = setInterval(() => {
					const diagnostics = getStylelintDiagnostics(uri);

					if (diagnostics.length > 0) {
						clearInterval(intervalRef);
						clearTimeout(timeoutRef);
						resolve(diagnostics);
					}
				}, interval);

				timeoutRef = setTimeout(() => {
					clearInterval(intervalRef);
					clearTimeout(timeoutRef);
					reject(new Error('Timed out waiting for Stylelint diagnostics'));
				}, timeout);
			});
		};
	},
});

Object.defineProperty(global, 'waitForApiEvent', {
	get() {
		return <T extends keyof ExtensionEvents>(
			event: T,
			shouldResolve?: (...params: Parameters<ExtensionEvents[T]>) => boolean,
			timeout = 5000,
		): Promise<Parameters<ExtensionEvents[T]>> => {
			const api = extensions.getExtension('stylelint.vscode-stylelint')?.exports as PublicApi;

			return new Promise((resolve, reject) => {
				const timeoutRef = setTimeout(() => {
					reject(new Error(`Timed out waiting for ${event} event`));
				}, timeout);

				const listener = (...params: unknown[]) => {
					if (shouldResolve) {
						if (shouldResolve(...(params as Parameters<ExtensionEvents[T]>))) {
							clearTimeout(timeoutRef);
							api.off(event, listener);
							resolve(params as Parameters<ExtensionEvents[T]>);
						}
					} else {
						clearTimeout(timeoutRef);
						api.off(event, listener);
						resolve(params as Parameters<ExtensionEvents[T]>);
					}
				};

				api.on(event, listener);

				setTimeout(() => {
					api.off(event, listener);
					reject(new Error(`Timed out waiting for ${event} event`));
				}, timeout);
			});
		};
	},
});

global.beforeAll(async () => {
	const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

	if (!vscodeStylelint) {
		throw new Error('Unable to find Stylelint extension');
	}

	await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });
});

global.afterEach(async () => {
	for (const editor of openEditors) {
		await window.showTextDocument(editor.document);
		await commands.executeCommand('workbench.action.files.revert');
	}

	openEditors.length = 0;

	await commands.executeCommand('workbench.action.closeAllEditors');
}, 10000);
