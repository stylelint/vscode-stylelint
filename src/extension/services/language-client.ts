import type { LanguageClientOptions } from 'vscode-languageclient/node';

import type { VSCodeWindow, VSCodeWorkspace } from './environment.js';

/**
 * Builds the language client options for Stylelint.
 */
export function createClientOptions(
	workspace: VSCodeWorkspace,
	window: VSCodeWindow,
): LanguageClientOptions {
	const watchedFiles = [
		'**/.stylelintrc{,.js,.cjs,.mjs,.json,.yaml,.yml}',
		'**/stylelint.config.{js,cjs,mjs}',
		'**/.stylelintignore',
		'**/{package.json,package-lock.json,yarn.lock,pnpm-lock.yaml,bun.lock}',
		'**/.pnp.{cjs,js}',
		'**/.pnp.loader.mjs',
	];

	return {
		documentSelector: [{ scheme: 'file' }, { scheme: 'untitled' }],
		diagnosticCollectionName: 'Stylelint',
		outputChannel: window.createOutputChannel('Stylelint'),
		synchronize: {
			fileEvents: watchedFiles.map((pattern) => workspace.createFileSystemWatcher(pattern)),
		},
	};
}
