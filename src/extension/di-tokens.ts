// @no-unit-test -- Token definitions only.

import type * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';
import type { LanguageClientOptions } from 'vscode-languageclient/node';
type LanguageClientModule = typeof import('vscode-languageclient/node');

import { createToken } from '@stylelint/language-server/di';

export const extensionTokens = {
	context: createToken<ExtensionContext>('extension-context'),
	serverModulePath: createToken<string>('extension-server-module-path'),
	clientOptions: createToken<LanguageClientOptions>('extension-client-options'),
	workspace: createToken<typeof vscode.workspace>('extension-workspace'),
	commands: createToken<typeof vscode.commands>('extension-commands'),
	window: createToken<typeof vscode.window>('extension-window'),
	languages: createToken<typeof vscode.languages>('extension-languages'),
	languageStatusSeverity: createToken<typeof vscode.LanguageStatusSeverity>(
		'extension-language-status-severity',
	),
	languageClientModule: createToken<LanguageClientModule>('extension-language-client-module'),
} as const;
