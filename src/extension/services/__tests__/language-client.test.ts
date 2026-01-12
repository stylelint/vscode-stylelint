import { describe, expect, test } from 'vitest';
import type {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
} from 'vscode-languageclient/node';

import {
	createClientOptions,
	createLanguageClient,
	createServerOptions,
	createSettingMonitorFactory,
} from '../language-client.js';
import type { LanguageClientModule, VSCodeWorkspace } from '../environment.js';

describe('language client services', () => {
	test('createClientOptions configures selectors and file watchers', () => {
		const watchedPatterns: string[] = [];
		const workspace = {
			createFileSystemWatcher(pattern: string) {
				watchedPatterns.push(pattern);

				return { dispose() {} };
			},
		} as unknown as VSCodeWorkspace;

		const options = createClientOptions(workspace);

		expect(options.documentSelector).toEqual([{ scheme: 'file' }, { scheme: 'untitled' }]);
		expect(options.diagnosticCollectionName).toBe('Stylelint');
		expect(watchedPatterns).toEqual([
			'**/.stylelintrc{,.js,.cjs,.mjs,.json,.yaml,.yml}',
			'**/stylelint.config.{js,cjs,mjs}',
			'**/.stylelintignore',
			'**/{package.json,package-lock.json,yarn.lock,pnpm-lock.yaml,bun.lock}',
			'**/.pnp.{cjs,js}',
			'**/.pnp.loader.mjs',
		]);
	});

	test('createServerOptions provides run and debug entries', () => {
		const workspace = {
			getConfiguration: () => ({
				get: (key: string) => (key === 'logLevel' ? 'debug' : undefined),
			}),
		} as unknown as VSCodeWorkspace;
		const options = createServerOptions('/tmp/server.js', workspace);
		const serverOptions = options as {
			run: { module: string; options?: { env?: Record<string, string> } };
			debug: { module: string; options?: { env?: Record<string, string>; execArgv?: string[] } };
		};

		expect(serverOptions.run.module).toBe('/tmp/server.js');
		expect(serverOptions.debug.module).toBe('/tmp/server.js');
		expect(serverOptions.debug.options?.execArgv).toEqual(['--nolazy', '--inspect=6004']);
		expect(serverOptions.run.options?.env?.STYLELINT_LOG_LEVEL).toBe('debug');
		expect(serverOptions.debug.options?.env?.STYLELINT_LOG_LEVEL).toBe('debug');
	});

	test('createSettingMonitorFactory wires monitor to client', () => {
		class FakeSettingMonitor {
			constructor(
				public client: LanguageClient,
				public section: string,
			) {}
		}

		const module = {
			LanguageClient: class {} as never,
			SettingMonitor: FakeSettingMonitor,
		} as unknown as LanguageClientModule;

		const factory = createSettingMonitorFactory(module);
		const client = {} as LanguageClient;
		const monitor = factory(client) as unknown as FakeSettingMonitor;

		expect(monitor).toBeInstanceOf(FakeSettingMonitor);
		expect(monitor.client).toBe(client);
		expect(monitor.section).toBe('stylelint.enable');
	});

	test('createLanguageClient instantiates the module LanguageClient', () => {
		class FakeLanguageClient {
			static lastArgs: [string, ServerOptions, LanguageClientOptions] | undefined;
			constructor(
				public name: string,
				public serverOptions: ServerOptions,
				public clientOptions: LanguageClientOptions,
			) {
				FakeLanguageClient.lastArgs = [name, serverOptions, clientOptions];
			}
		}

		const module = {
			SettingMonitor: class {} as never,
			LanguageClient: FakeLanguageClient,
		} as unknown as LanguageClientModule;

		const serverOptions = { run: { module: 'run' }, debug: { module: 'debug' } } as ServerOptions;
		const clientOptions = { documentSelector: [] } as LanguageClientOptions;

		const client = createLanguageClient(
			module,
			serverOptions,
			clientOptions,
		) as unknown as FakeLanguageClient;

		expect(client).toBeInstanceOf(FakeLanguageClient);
		expect(FakeLanguageClient.lastArgs).toEqual(['Stylelint', serverOptions, clientOptions]);
	});
});
