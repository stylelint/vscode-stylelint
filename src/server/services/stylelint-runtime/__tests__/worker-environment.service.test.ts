import type { PathLike } from 'node:fs';
import path from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { FsPromisesModuleToken, PathModuleToken } from '../../../tokens.js';
import { PackageRootService } from '../package-root.service.js';
import { WorkerEnvironmentService } from '../worker-environment.service.js';

type TimestampMap = Record<string, number>;

type StatLike = {
	isFile: () => boolean;
	mtimeMs: number;
};

const createStat = (timestamps: TimestampMap) =>
	vi.fn(async (target: PathLike): Promise<StatLike> => {
		const key = target.toString();

		if (timestamps[key] === undefined) {
			const error = new Error('ENOENT');

			(error as NodeJS.ErrnoException).code = 'ENOENT';
			throw error;
		}

		return {
			isFile: () => true,
			mtimeMs: timestamps[key],
		};
	});

const createService = (timestamps: TimestampMap, stylelintPackageRoot: string) => {
	const stat = createStat(timestamps);
	const fsModule = { stat } as unknown as typeof import('node:fs/promises');
	const packageRootService = {
		find: vi.fn(async (_startPath: string) => stylelintPackageRoot),
	} as unknown as PackageRootService;

	const container = createContainer(
		module({
			register: [
				provideTestValue(PackageRootService, () => packageRootService),
				provideTestValue(FsPromisesModuleToken, () => fsModule),
				provideTestValue(PathModuleToken, () => path),
				WorkerEnvironmentService,
			],
		}),
	);

	return { service: container.resolve(WorkerEnvironmentService), stat, packageRootService };
};

describe('WorkerEnvironmentService', () => {
	test('encodes relevant timestamps into the environment key', async () => {
		const workspaceRoot = path.resolve('/workspace');
		const stylelintRoot = path.join(workspaceRoot, 'node_modules/stylelint');
		const stylelintPath = path.join(stylelintRoot, 'index.js');
		const { service } = createService(
			{
				[path.join(workspaceRoot, 'package.json')]: 100,
				[path.join(workspaceRoot, 'package-lock.json')]: 200,
				[stylelintPath]: 300,
				[path.join(stylelintRoot, 'package.json')]: 400,
			},
			stylelintRoot,
		);

		const key = await service.createKey({
			workerRoot: workspaceRoot,
			stylelintPath,
		});

		expect(key).toContain('pkg:100');
		expect(key).toContain('npmLock:200');
		expect(key).toContain('stylelintEntry:300');
		expect(key).toContain('stylelintPkg:400');
	});

	test('changes when manifest timestamps change', async () => {
		const workspaceRoot = path.resolve('/workspace');
		const stylelintRoot = path.join(workspaceRoot, 'node_modules/stylelint');
		const stylelintPath = path.join(stylelintRoot, 'index.js');
		const timestamps: TimestampMap = {
			[path.join(workspaceRoot, 'package.json')]: 100,
			[stylelintPath]: 300,
			[path.join(stylelintRoot, 'package.json')]: 400,
		};
		const { service } = createService(timestamps, stylelintRoot);

		const initialKey = await service.createKey({
			workerRoot: workspaceRoot,
			stylelintPath,
		});

		timestamps[path.join(workspaceRoot, 'package.json')] = 500;

		const updatedKey = await service.createKey({
			workerRoot: workspaceRoot,
			stylelintPath,
		});

		expect(initialKey).not.toBe(updatedKey);
	});
});
