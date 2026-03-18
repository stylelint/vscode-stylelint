import path from 'node:path';
import { describe, expect, test, vi, type MockedFunction } from 'vitest';

import { PackageRootCacheService } from '../package-root-cache.service.js';
import type { PackageRootService } from '../package-root.service.js';

const createPackageRootFinder = () => {
	const find: MockedFunction<PackageRootService['find']> = vi.fn();

	return {
		instance: {
			find,
		} as unknown as PackageRootService,
		find,
	};
};

describe('PackageRootCacheService', () => {
	test('caches package root lookups across determinations', async () => {
		const finder = createPackageRootFinder();
		const service = new PackageRootCacheService(finder.instance);

		finder.find.mockResolvedValue('/workspace');

		const request = {
			workspaceFolder: '/workspace',
			codeFilename: '/workspace/packages/app/src/file.css',
		};

		await expect(
			service.determineWorkerRoot(request.workspaceFolder, request.codeFilename),
		).resolves.toBe('/workspace');
		await expect(
			service.determineWorkerRoot(request.workspaceFolder, request.codeFilename),
		).resolves.toBe('/workspace');

		expect(finder.find).toHaveBeenCalledTimes(1);
	});

	test('invalidates cached package roots when manifest files change', async () => {
		const finder = createPackageRootFinder();
		const service = new PackageRootCacheService(finder.instance);
		const codeFilename = '/workspace/packages/app/src/file.css';

		finder.find.mockResolvedValue('/workspace/packages/app');

		await service.determineWorkerRoot('/workspace', codeFilename);
		service.invalidateForFile('/workspace/packages/app/package.json');
		await service.determineWorkerRoot('/workspace', codeFilename);

		expect(finder.find).toHaveBeenCalledTimes(2);
	});

	test('uses the Stylelint path as a fallback when no code filename is provided', async () => {
		const finder = createPackageRootFinder();
		const service = new PackageRootCacheService(finder.instance);

		finder.find.mockResolvedValue('/workspace');

		await service.determineWorkerRoot('/workspace', undefined, 'node_modules/stylelint/index.js');

		const expectedPath = path.join('/workspace', 'node_modules', 'stylelint', 'index.js');

		expect(finder.find).toHaveBeenCalledWith(expectedPath);
	});
});
