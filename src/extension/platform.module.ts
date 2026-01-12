// @no-unit-test -- Module definition file that only registers platform dependencies.

import type { ExtensionContext } from 'vscode';

import { module, type ModuleMetadata, provideValue } from '../di/index.js';
import { extensionTokens } from './di-tokens.js';
import {
	getLanguageClientModule,
	getVsCodeModule,
	resolveServerModulePath,
} from './services/environment.js';

/**
 * Creates the extension platform module that wires host-specific dependencies.
 */
export function createExtensionPlatformModule(context: ExtensionContext): ModuleMetadata {
	return module({
		register: [
			provideValue(extensionTokens.context, () => context),
			provideValue(extensionTokens.workspace, () => getVsCodeModule().workspace),
			provideValue(extensionTokens.commands, () => getVsCodeModule().commands),
			provideValue(extensionTokens.window, () => getVsCodeModule().window),
			provideValue(extensionTokens.languageClientModule, () => getLanguageClientModule()),
			provideValue(extensionTokens.serverModulePath, () => resolveServerModulePath()),
		],
	});
}
