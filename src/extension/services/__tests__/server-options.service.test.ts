import { beforeEach, describe, expect, it } from 'vitest';
import type { NodeModule } from 'vscode-languageclient/node';

import { createContainer, module, provideTestValue } from '@stylelint/language-server/di';
import { extensionTokens } from '../../di-tokens.js';
import type { VSCodeWorkspace } from '../environment.js';
import { ServerOptionsService } from '../server-options.service.js';

type ModuleServerOptions = { run: NodeModule; debug: NodeModule };

function createWorkspace(settings: Record<string, unknown> = {}): VSCodeWorkspace {
	return {
		getConfiguration: () => ({
			get: (key: string, defaultValue?: unknown) => settings[key] ?? defaultValue ?? undefined,
		}),
	} as unknown as VSCodeWorkspace;
}

describe('ServerOptionsService', () => {
	let service: ServerOptionsService;
	let workspace: VSCodeWorkspace;

	beforeEach(() => {
		workspace = createWorkspace();

		const container = createContainer(
			module({
				register: [
					provideTestValue(extensionTokens.serverModulePath, () => '/mock/server.js'),
					provideTestValue(extensionTokens.workspace, () => workspace),
					ServerOptionsService,
				],
			}),
		);

		service = container.resolve(ServerOptionsService);
	});

	it('should return server options with module path', () => {
		const options = service.getServerOptions() as ModuleServerOptions;

		expect(options.run.module).toBe('/mock/server.js');
		expect(options.debug.module).toBe('/mock/server.js');
	});

	it('should include debug exec args in debug options', () => {
		const options = service.getServerOptions() as ModuleServerOptions;

		expect(options.debug.options?.execArgv).toEqual(['--nolazy', '--inspect=6004']);
	});

	it('should set log level in environment', () => {
		workspace = createWorkspace({ logLevel: 'debug' });

		const container = createContainer(
			module({
				register: [
					provideTestValue(extensionTokens.serverModulePath, () => '/mock/server.js'),
					provideTestValue(extensionTokens.workspace, () => workspace),
					ServerOptionsService,
				],
			}),
		);

		service = container.resolve(ServerOptionsService);
		const options = service.getServerOptions() as ModuleServerOptions;

		expect(options.run.options?.env?.STYLELINT_LOG_LEVEL).toBe('debug');
		expect(options.debug.options?.env?.STYLELINT_LOG_LEVEL).toBe('debug');
	});

	it('should include runtime when configured', () => {
		workspace = createWorkspace({ runtime: '/usr/local/bin/node' });

		const container = createContainer(
			module({
				register: [
					provideTestValue(extensionTokens.serverModulePath, () => '/mock/server.js'),
					provideTestValue(extensionTokens.workspace, () => workspace),
					ServerOptionsService,
				],
			}),
		);

		service = container.resolve(ServerOptionsService);
		const options = service.getServerOptions() as ModuleServerOptions;

		expect(options.run.runtime).toBe('/usr/local/bin/node');
		expect(options.debug.runtime).toBe('/usr/local/bin/node');
	});

	it('should not include runtime when not configured', () => {
		const options = service.getServerOptions() as ModuleServerOptions;

		expect(options.run).not.toHaveProperty('runtime');
		expect(options.debug).not.toHaveProperty('runtime');
	});

	it('should include execArgv when configured', () => {
		workspace = createWorkspace({ execArgv: ['--max-old-space-size=4096'] });

		const container = createContainer(
			module({
				register: [
					provideTestValue(extensionTokens.serverModulePath, () => '/mock/server.js'),
					provideTestValue(extensionTokens.workspace, () => workspace),
					ServerOptionsService,
				],
			}),
		);

		service = container.resolve(ServerOptionsService);
		const options = service.getServerOptions() as ModuleServerOptions;

		expect(options.run.options?.execArgv).toEqual(['--max-old-space-size=4096']);
		expect(options.debug.options?.execArgv).toEqual([
			'--max-old-space-size=4096',
			'--nolazy',
			'--inspect=6004',
		]);
	});
});
