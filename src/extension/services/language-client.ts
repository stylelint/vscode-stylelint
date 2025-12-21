import process from 'node:process';
import type {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	SettingMonitor,
} from 'vscode-languageclient/node';

import type { LanguageClientModule, VSCodeWorkspace } from './environment.js';
import { parseLogLevel } from '../../shared/log-level.js';

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
export function createServerOptions(modulePath: string, workspace: VSCodeWorkspace): ServerOptions {
	const configuredLogLevel = workspace.getConfiguration('stylelint').get<string>('logLevel');
	const logLevel = parseLogLevel(configuredLogLevel) ?? 'info';
	const env = { ...process.env, STYLELINT_LOG_LEVEL: logLevel };

	return {
		run: {
			module: modulePath,
			options: {
				env,
			},
		},
		debug: {
			module: modulePath,
			options: {
				execArgv: ['--nolazy', '--inspect=6004'],
				env,
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
