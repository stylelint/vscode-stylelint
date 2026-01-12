import { describe, expect, test, vi } from 'vitest';
import type { Connection } from 'vscode-languageserver';

import type { InjectionToken } from '../../../di/inject.js';
import type { ModuleMetadata } from '../../../di/module.js';
import type { RuntimeApplicationOptions } from '../../../di/runtime/application.js';
import type { RuntimeApplication, RuntimeFeature } from '../../../di/runtime/index.js';
import { lspConnectionToken } from '../../tokens.js';
import { createLanguageServerApplication } from '../application.js';

function createConnectionStub() {
	let shutdownHandler: (() => void | Promise<void>) | undefined;

	return {
		onShutdown: vi.fn((handler: () => void | Promise<void>) => {
			shutdownHandler = handler;
		}),
		triggerShutdown: () => shutdownHandler?.(),
	} as unknown as Connection & { triggerShutdown(): void | Promise<void> };
}

describe('createLanguageServerApplication', () => {
	test('configures runtime overrides and features', () => {
		const modules: ModuleMetadata[] = [{ providers: new Map() }];
		const customToken = Symbol('custom') as InjectionToken<number>;
		const overrides: [InjectionToken<unknown>, unknown][] = [[customToken, 42]];
		const connection = createConnectionStub();
		const runtimeFeature: RuntimeFeature = {};
		const runtimeApplication = {
			start: vi.fn(),
			dispose: vi.fn(),
		} as unknown as RuntimeApplication;
		const createRuntimeApplicationMock = vi
			.fn<(options: RuntimeApplicationOptions) => RuntimeApplication>()
			.mockReturnValue(runtimeApplication);
		const createLanguageServerFeatureMock = vi
			.fn<(options: { connection: Connection }) => RuntimeFeature>()
			.mockReturnValue(runtimeFeature);

		const result = createLanguageServerApplication({
			connection,
			modules,
			overrides,
			factories: {
				createRuntimeApplication: createRuntimeApplicationMock,
				createLanguageServerFeature: createLanguageServerFeatureMock,
			},
		});
		const runtimeOptions = createRuntimeApplicationMock.mock.calls[0]?.[0] as
			| RuntimeApplicationOptions
			| undefined;
		const { overrides: resolvedOverrides, features } = runtimeOptions ?? {};

		expect(result).toBe(runtimeApplication);
		expect(createLanguageServerFeatureMock).toHaveBeenCalledWith({ connection });
		expect(features).toEqual([runtimeFeature]);
		expect(Array.from(resolvedOverrides ?? [])).toEqual(
			expect.arrayContaining([
				[lspConnectionToken, connection],
				[customToken, 42],
			]),
		);
	});

	test('disposes runtime when the connection shuts down', async () => {
		const modules: ModuleMetadata[] = [{ providers: new Map() }];
		const connection = createConnectionStub();
		const runtimeApplication = {
			start: vi.fn(),
			dispose: vi.fn().mockResolvedValue(undefined),
		} as unknown as RuntimeApplication;
		const createRuntimeApplicationMock = vi
			.fn<(options: RuntimeApplicationOptions) => RuntimeApplication>()
			.mockReturnValue(runtimeApplication);
		const createLanguageServerFeatureMock = vi
			.fn<(options: { connection: Connection }) => RuntimeFeature>()
			.mockReturnValue({});

		createLanguageServerApplication({
			connection,
			modules,
			factories: {
				createRuntimeApplication: createRuntimeApplicationMock,
				createLanguageServerFeature: createLanguageServerFeatureMock,
			},
		});

		await connection.triggerShutdown();

		expect(runtimeApplication.dispose).toHaveBeenCalledTimes(1);
	});
});
