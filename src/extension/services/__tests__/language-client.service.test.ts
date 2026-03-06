import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

import { createContainer, module, provideTestValue } from '../../../di/index.js';
import { extensionTokens } from '../../di-tokens.js';
import type { LanguageClientModule } from '../environment.js';
import { LanguageClientService } from '../language-client.service.js';
import { ServerOptionsService } from '../server-options.service.js';

describe('LanguageClientService', () => {
	const mockServerOptions = { run: { module: '/mock/server.js' } } as ServerOptions;
	const mockClientOptions = { documentSelector: [] } as LanguageClientOptions;
	let createdClients: object[];
	let mockLanguageClientModule: LanguageClientModule;
	let mockServerOptionsService: ServerOptionsService;
	let service: LanguageClientService;

	beforeEach(() => {
		createdClients = [];

		// eslint-disable-next-line prefer-arrow-callback -- Must be constructable via new
		const FakeClient = vi.fn(function FakeLanguageClient() {
			const instance = {};

			createdClients.push(instance);

			return instance;
		});

		mockLanguageClientModule = {
			LanguageClient: FakeClient as unknown as LanguageClientModule['LanguageClient'],
			SettingMonitor: class {} as never,
		} as unknown as LanguageClientModule;

		mockServerOptionsService = {
			getServerOptions: vi.fn(() => mockServerOptions),
		} as unknown as ServerOptionsService;

		const container = createContainer(
			module({
				register: [
					provideTestValue(extensionTokens.languageClientModule, () => mockLanguageClientModule),
					provideTestValue(extensionTokens.clientOptions, () => mockClientOptions),
					{
						token: ServerOptionsService,
						useFactory: () => mockServerOptionsService,
					},
					LanguageClientService,
				],
			}),
		);

		service = container.resolve(LanguageClientService);
	});

	it('should create a language client with correct arguments', () => {
		const client = service.createClient();
		const ctor = mockLanguageClientModule.LanguageClient as unknown as ReturnType<typeof vi.fn>;

		expect(client).toBe(createdClients[0]);
		expect(ctor).toHaveBeenCalledWith('Stylelint', mockServerOptions, mockClientOptions);
	});

	it('should create a new client each time', () => {
		const first = service.createClient();
		const second = service.createClient();

		expect(first).not.toBe(second);
		expect(createdClients).toHaveLength(2);
	});

	it('should get fresh server options for each client', () => {
		const freshOptions = { run: { module: '/new/server.js' } } as ServerOptions;

		service.createClient();

		(mockServerOptionsService.getServerOptions as ReturnType<typeof vi.fn>).mockReturnValueOnce(
			freshOptions,
		);

		service.createClient();

		const ctor = mockLanguageClientModule.LanguageClient as unknown as ReturnType<typeof vi.fn>;

		expect(ctor).toHaveBeenLastCalledWith('Stylelint', freshOptions, mockClientOptions);
	});
});
