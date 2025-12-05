import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from 'vscode-languageserver';

import { createTestLogger, type TestLogger } from '../../../../../test/helpers/index.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { defaultLanguageServerOptions } from '../../../config/default-options.js';
import { lspConnectionToken } from '../../../tokens.js';
import { type LoggingService, loggingServiceToken } from '../../infrastructure/logging.service.js';
import { WorkspaceOptionsService } from '../workspace-options.service.js';

function createConnection() {
	const getConfiguration = vi.fn();
	const connection = {
		workspace: {
			getConfiguration,
		},
	} as unknown as Connection;

	return { connection, getConfiguration };
}

describe('WorkspaceOptionsService', () => {
	let service: WorkspaceOptionsService;
	let logger: TestLogger;
	let connection: Connection;
	let getConfiguration: ReturnType<typeof createConnection>['getConfiguration'];
	let loggingService: LoggingService;

	beforeEach(() => {
		logger = createTestLogger();
		({ connection, getConfiguration } = createConnection());
		loggingService = {
			createLogger: () => logger,
		};

		const container = createContainer(
			module({
				register: [
					provideTestValue(lspConnectionToken, () => connection),
					provideTestValue(loggingServiceToken, () => loggingService),
					WorkspaceOptionsService,
				],
			}),
		);

		service = container.resolve(WorkspaceOptionsService);
	});

	it('should return global options when scoped configuration unsupported', async () => {
		service.updateGlobalOptions({ stylelint: { validate: ['scss'] } });

		const result = await service.getOptions('file:///test.css');

		expect(result.validate).toEqual(['scss']);
		expect(Object.isFrozen(result)).toBe(true);
		expect(getConfiguration).not.toHaveBeenCalled();
	});

	it('should request and merge scoped options when supported', async () => {
		service.setSupportsWorkspaceConfiguration(true);
		getConfiguration.mockResolvedValueOnce({ validate: ['less'] });

		const first = await service.getOptions('file:///less.css');

		getConfiguration.mockResolvedValueOnce(undefined);
		const second = await service.getOptions('file:///less.css');

		expect(getConfiguration).toHaveBeenCalledTimes(2);
		expect(first).not.toBe(second);
		expect(first.validate).toEqual(['less']);
		expect(second).toEqual(defaultLanguageServerOptions);
	});

	it('clearCache should drop in-flight requests', async () => {
		service.setSupportsWorkspaceConfiguration(true);
		let resolveFirst: ((value: unknown) => void) | undefined;

		getConfiguration.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveFirst = resolve;
			}),
		);

		const pending = service.getOptions('file:///test.css');

		service.clearCache();
		getConfiguration.mockResolvedValueOnce({ validate: ['scss'] });
		const second = service.getOptions('file:///test.css');

		resolveFirst?.({ validate: ['less'] });
		await pending;
		await second;

		expect(getConfiguration).toHaveBeenCalledTimes(2);
	});

	it('setSupportsWorkspaceConfiguration(false) should clear cache and stop requesting options', async () => {
		service.setSupportsWorkspaceConfiguration(true);
		getConfiguration.mockResolvedValue({ validate: ['scss'] });

		await service.getOptions('file:///test.css');
		service.setSupportsWorkspaceConfiguration(false);
		await service.getOptions('file:///test.css');

		expect(getConfiguration).toHaveBeenCalledTimes(1);
	});

	it('delete should drop in-flight request for resource', async () => {
		service.setSupportsWorkspaceConfiguration(true);
		let resolveFirst: ((value: unknown) => void) | undefined;

		getConfiguration.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveFirst = resolve;
			}),
		);

		const pending = service.getOptions('file:///test.css');

		service.delete('file:///test.css');
		getConfiguration.mockResolvedValueOnce({ validate: ['scss'] });
		const second = service.getOptions('file:///test.css');

		resolveFirst?.({ validate: ['less'] });
		await pending;
		await second;

		expect(getConfiguration).toHaveBeenCalledTimes(2);
	});
});
