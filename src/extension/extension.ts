import type { ExtensionContext } from 'vscode';

import {
	createRuntimeApplication,
	type RuntimeApplication,
	type RuntimeApplicationOptions,
} from '../di/runtime/index.js';
import { extensionTokens } from './di-tokens.js';
import { extensionModule } from './extension.module.js';
import { createExtensionPlatformModule } from './platform.module.js';
import type { VSCodeWindow } from './services/environment.js';

let application: RuntimeApplication | undefined;
let resolvedWindow: VSCodeWindow | undefined;

/**
 * Activates the extension.
 */
export async function activate(
	context: ExtensionContext,
	overrides?: RuntimeApplicationOptions['overrides'],
): Promise<void> {
	if (application) {
		return;
	}

	application = createRuntimeApplication({
		modules: [createExtensionPlatformModule(context), extensionModule],
		overrides,
	});

	try {
		await application.start();
	} catch (error) {
		application = undefined;
		throw error;
	}

	resolvedWindow = application.resolve(extensionTokens.window);
}

/**
 * @returns A promise that resolves when the client has been deactivated.
 */
export async function deactivate(): Promise<void> {
	if (!application) {
		return;
	}

	try {
		await application.dispose();
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'unknown';
		const windowApi = resolvedWindow ?? (await import('vscode')).window;

		await windowApi.showErrorMessage(`error stopping stylelint language server: ${msg}`);
		application = undefined;

		throw err;
	}

	application = undefined;
}
