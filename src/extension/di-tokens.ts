// @no-unit-test -- Token definitions only.

import type * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';
import type {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	SettingMonitor,
} from 'vscode-languageclient/node';
type LanguageClientModule = typeof import('vscode-languageclient/node');

import { createToken } from '../di/index.js';
import type { PublicApi } from './types.js';

export const extensionTokens = {
	context: createToken<ExtensionContext>('extension-context'),
	serverModulePath: createToken<string>('extension-server-module-path'),
	serverOptions: createToken<ServerOptions>('extension-server-options'),
	clientOptions: createToken<LanguageClientOptions>('extension-client-options'),
	workspace: createToken<typeof vscode.workspace>('extension-workspace'),
	commands: createToken<typeof vscode.commands>('extension-commands'),
	window: createToken<typeof vscode.window>('extension-window'),
	languageClientModule: createToken<LanguageClientModule>('extension-language-client-module'),
	settingMonitorFactory: createToken<(client: LanguageClient) => SettingMonitor>(
		'extension-setting-monitor-factory',
	),
	languageClient: createToken<LanguageClient>('extension-language-client'),
	publicApi: createToken<PublicApi>('extension-public-api'),
} as const;
