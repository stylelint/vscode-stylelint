import type { PathLike, Stats } from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, Mocked, test, vi } from 'vitest';

import { PnPConfigurationCacheService } from '../pnp-configuration-cache.service.js';

const createFsMock = (existingFiles: Set<string>): Mocked<Pick<typeof fsPromises, 'stat'>> => {
	const stat = vi.fn(async (filePath: PathLike) => {
		const fileKey = filePath.toString();

		if (!existingFiles.has(fileKey)) {
			throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
		}

		return {
			isFile: () => true,
		} as Stats;
	});

	return { stat } as unknown as Mocked<Pick<typeof fsPromises, 'stat'>>;
};

describe('PnPConfigurationCacheService', () => {
	test('finds and caches PnP configuration files', async () => {
		const workspace = path.resolve('/workspace');
		const existingFiles = new Set([path.join(workspace, '.pnp.cjs')]);
		const fsMock = createFsMock(existingFiles);
		const service = new PnPConfigurationCacheService(fsMock, path);
		const codeFilename = path.join(workspace, 'src/file.css');

		await expect(service.findConfiguration(codeFilename)).resolves.toMatchObject({
			registerPath: path.join(workspace, '.pnp.cjs'),
		});
		const callsAfterFirstLookup = fsMock.stat.mock.calls.length;

		await expect(service.findConfiguration(codeFilename)).resolves.toMatchObject({
			registerPath: path.join(workspace, '.pnp.cjs'),
		});

		expect(fsMock.stat).toHaveBeenCalledTimes(callsAfterFirstLookup);
	});

	test('invalidates cached configurations when PnP files change', async () => {
		const workspace = path.resolve('/workspace');
		const existingFiles = new Set([path.join(workspace, '.pnp.cjs')]);
		const fsMock = createFsMock(existingFiles);
		const service = new PnPConfigurationCacheService(fsMock, path);
		const codeFilename = path.join(workspace, 'src/file.css');

		await service.findConfiguration(codeFilename);
		const callsBeforeInvalidation = fsMock.stat.mock.calls.length;

		service.invalidateForFile(path.join(workspace, '.pnp.cjs'));
		await service.findConfiguration(codeFilename);

		expect(fsMock.stat.mock.calls.length).toBeGreaterThan(callsBeforeInvalidation);
	});

	test('resolves configuration keys consistently', () => {
		const service = new PnPConfigurationCacheService(fsPromises, path);

		expect(
			service.resolveConfigKey({
				registerPath: '/workspace/.pnp.cjs',
				loaderPath: '/workspace/.pnp.loader.mjs',
			}),
		).toBe('/workspace/.pnp.cjs|/workspace/.pnp.loader.mjs');
	});
});
