import type {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	SettingMonitor,
} from 'vscode-languageclient/node';

import type { LanguageClientModule, VSCodeWorkspace } from './environment.js';

export type SettingMonitorFactory = (client: LanguageClient) => SettingMonitor;

/**
 * Builds the language client options for Stylelint.
 */
export function createClientOptions(workspace: VSCodeWorkspace): LanguageClientOptions {
	return {
		documentSelector: [{ scheme: 'file' }, { scheme: 'untitled' }],
		diagnosticCollectionName: 'Stylelint',
		synchronize: {
			fileEvents: [
				workspace.createFileSystemWatcher('**/.stylelintrc{,.js,.cjs,.mjs,.json,.yaml,.yml}'),
				workspace.createFileSystemWatcher('**/stylelint.config.{js,cjs,mjs}'),
				workspace.createFileSystemWatcher('**/.stylelintignore'),
			],
		},
	};
}

/**
 * Creates the run/debug configuration for the language server process.
 */
export function createServerOptions(modulePath: string): ServerOptions {
	return {
		run: {
			module: modulePath,
		},
		debug: {
			module: modulePath,
			options: {
				execArgv: ['--nolazy', '--inspect=6004'],
			},
		},
	};
}

/**
 * Creates a factory that wires the VS Code SettingMonitor to the client instance.
 */
export function createSettingMonitorFactory(
	languageClientModule: LanguageClientModule,
): SettingMonitorFactory {
	return (client: LanguageClient) =>
		new languageClientModule.SettingMonitor(client, 'stylelint.enable');
}

/**
 * Instantiates the Stylelint language client with the resolved dependencies.
 */
export function createLanguageClient(
	languageClientModule: LanguageClientModule,
	serverOptions: ServerOptions,
	clientOptions: LanguageClientOptions,
): LanguageClient {
	return new languageClientModule.LanguageClient('Stylelint', serverOptions, clientOptions);
}
