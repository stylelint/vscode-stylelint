import { describe, expect, test } from 'vitest';

import { createClientOptions } from '../language-client.js';
import type { VSCodeWindow, VSCodeWorkspace } from '../environment.js';

describe('language client services', () => {
	test('createClientOptions configures selectors and file watchers', () => {
		const watchedPatterns: string[] = [];
		const workspace = {
			createFileSystemWatcher(pattern: string) {
				watchedPatterns.push(pattern);

				return { dispose() {} };
			},
		} as unknown as VSCodeWorkspace;

		const mockOutputChannel = { name: 'Stylelint' };
		const window = {
			createOutputChannel: () => mockOutputChannel,
		} as unknown as VSCodeWindow;

		const options = createClientOptions(workspace, window);

		expect(options.documentSelector).toEqual([{ scheme: 'file' }, { scheme: 'untitled' }]);
		expect(options.diagnosticCollectionName).toBe('Stylelint');
		expect(options.outputChannel).toBe(mockOutputChannel);
		expect(watchedPatterns).toEqual([
			'**/.stylelintrc{,.js,.cjs,.mjs,.json,.yaml,.yml}',
			'**/stylelint.config.{js,cjs,mjs}',
			'**/.stylelintignore',
			'**/{package.json,package-lock.json,yarn.lock,pnpm-lock.yaml,bun.lock}',
			'**/.pnp.{cjs,js}',
			'**/.pnp.loader.mjs',
		]);
	});
});
