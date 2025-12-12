// @no-unit-test -- Depends on VS Code host modules that are only available inside the extension runtime.
import path from 'node:path';

export type VSCodeModule = typeof import('vscode');
export type LanguageClientModule = typeof import('vscode-languageclient/node');

let cachedVsCodeModule: VSCodeModule | undefined;
let cachedLanguageClientModule: LanguageClientModule | undefined;

// This file is necessary since the vscode module is only available within the
// extension host and is not a real package in the registry.

/**
 * Lazily loads the VS Code API.
 */
export function getVsCodeModule(): VSCodeModule {
	if (!cachedVsCodeModule) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- Loaded lazily within extension host.
		cachedVsCodeModule = require('vscode') as VSCodeModule;
	}

	return cachedVsCodeModule;
}

/**
 * Lazily loads the VS Code language client module.
 */
export function getLanguageClientModule(): LanguageClientModule {
	if (!cachedLanguageClientModule) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- Loaded lazily within extension host.
		cachedLanguageClientModule = require('vscode-languageclient/node') as LanguageClientModule;
	}

	return cachedLanguageClientModule;
}

export type VSCodeWorkspace = VSCodeModule['workspace'];
export type VSCodeCommands = VSCodeModule['commands'];
export type VSCodeWindow = VSCodeModule['window'];

/**
 * Resolves the path to the compiled language server entry point.
 */
export function resolveServerModulePath(): string {
	return path.join(__dirname, 'start-server.js');
}
