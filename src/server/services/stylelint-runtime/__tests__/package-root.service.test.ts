import type { Stats } from 'fs';
import path from 'node:path/posix';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { FsPromisesModuleToken, PathModuleToken } from '../../../tokens.js';
import { createError } from '../../../../../test/mockSystemErrors.js';
import { PackageRootService } from '../package-root.service.js';

type FileSystemLeaf = string | Error;
interface FileSystemTree {
	[key: string]: FileSystemEntry;
}
type FileSystemEntry = FileSystemLeaf | FileSystemTree;

let tree: FileSystemTree = Object.create(null);
let finder: PackageRootService;

const setFileSystem = (value: FileSystemTree) => {
	tree = value;
};

const toPathString = (value: string | URL): string =>
	typeof value === 'string' ? value : value.toString();

const getEntry = (targetPath: string): FileSystemEntry | undefined => {
	const segments = targetPath.split(path.sep).filter(Boolean);
	let current: FileSystemEntry = tree;

	if (!segments.length) {
		return current;
	}

	for (const segment of segments) {
		if (current instanceof Error) {
			return current;
		}

		if (typeof current === 'string') {
			return undefined;
		}

		current = current?.[segment];

		if (current === undefined) {
			return undefined;
		}
	}

	return current;
};

const createStats = (isDirectory: boolean): Stats =>
	({
		isDirectory: () => isDirectory,
		isFile: () => !isDirectory,
	}) as Stats;

beforeEach(() => {
	tree = Object.create(null);
	const stat = vi.fn(async (value: string | URL) => {
		const targetPath = toPathString(value);
		const entry = getEntry(targetPath);

		if (entry === undefined) {
			throw createError('ENOENT', targetPath, -4058, 'stat');
		}

		if (entry instanceof Error) {
			throw entry;
		}

		return createStats(typeof entry !== 'string');
	}) as unknown as Pick<typeof import('fs/promises'), 'stat'>['stat'];

	const container = createContainer(
		module({
			register: [
				provideTestValue(FsPromisesModuleToken, () => ({ stat })),
				provideTestValue(PathModuleToken, () => path),
				PackageRootService,
			],
		}),
	);

	finder = container.resolve(PackageRootService);
});

describe('findPackageRoot', () => {
	describe('with defaults', () => {
		it('should resolve the package directory when package.json is present', async () => {
			setFileSystem({
				foo: {
					bar: {
						'package.json': '{}',
						baz: {},
					},
				},
			});

			expect(await finder.find('foo/bar/baz')).toBe('foo/bar');
		});

		it('should resolve the package directory when the starting path points to a file', async () => {
			setFileSystem({
				foo: {
					bar: {
						'package.json': '{}',
						baz: '',
					},
				},
			});

			expect(await finder.find('foo/bar/baz')).toBe('foo/bar');
		});

		it('should resolve the package directory when starting with a file path on a platform that throws ENOTDIR', async () => {
			setFileSystem({
				foo: {
					bar: {
						'package.json': '{}',
						baz: createError('ENOTDIR', 'foo/bar/baz', -20, 'stat'),
					},
				},
			});

			expect(await finder.find('foo/bar/baz')).toBe('foo/bar');
		});

		it("should not resolve when package.json isn't in the tree", async () => {
			setFileSystem({
				foo: {
					bar: {
						baz: {},
					},
				},
			});

			expect(await finder.find('foo/bar/baz')).toBeUndefined();
		});

		it('should not resolve folders with a directory named package.json', async () => {
			setFileSystem({
				foo: {
					'package.json': '{}',
					bar: {
						'package.json': {},
						baz: {},
					},
				},
			});

			expect(await finder.find('foo/bar/baz')).toBe('foo');

			setFileSystem({
				foo: {
					'package.json': {},
					bar: {
						baz: {},
					},
				},
			});

			expect(await finder.find('foo/bar/baz')).toBeUndefined();

			setFileSystem({
				'package.json': {},
				foo: {
					bar: {
						baz: {},
					},
				},
			});

			expect(await finder.find('foo/bar/baz')).toBeUndefined();
		});

		it('should throw when encountering a file system error other than ENOENT or ENOTDIR', async () => {
			setFileSystem({
				foo: {
					bar: {
						baz: createError('EACCES', 'foo/bar/baz', -13, 'stat'),
					},
				},
			});

			await expect(finder.find('foo/bar/baz')).rejects.toThrowErrorMatchingSnapshot();
		});
	});

	describe('with custom root file', () => {
		it('should resolve the package directory when the root file is present', async () => {
			setFileSystem({
				foo: {
					bar: {
						'yarn.lock': '',
						baz: {},
					},
				},
			});

			expect(await finder.find('foo/bar/baz', 'yarn.lock')).toBe('foo/bar');
		});

		it('should resolve the package directory when the starting path points to a file', async () => {
			setFileSystem({
				foo: {
					bar: {
						'yarn.lock': '',
						baz: '',
					},
				},
			});

			expect(await finder.find('foo/bar/baz', 'yarn.lock')).toBe('foo/bar');
		});

		it('should resolve the package directory when starting with a file path on a platform that throws ENOTDIR', async () => {
			setFileSystem({
				foo: {
					bar: {
						'yarn.lock': '{}',
						baz: createError('ENOTDIR', 'foo/bar/baz', -20, 'stat'),
					},
				},
			});

			expect(await finder.find('foo/bar/baz', 'yarn.lock')).toBe('foo/bar');
		});

		it("should not resolve when the root file isn't in the tree", async () => {
			setFileSystem({
				foo: {
					bar: {
						baz: {},
					},
				},
			});

			expect(await finder.find('foo/bar/baz', 'yarn.lock')).toBeUndefined();
		});

		it('should not resolve folders with a directory with the same name as the root file', async () => {
			setFileSystem({
				foo: {
					'yarn.lock': '',
					bar: {
						'yarn.lock': {},
						baz: {},
					},
				},
			});

			expect(await finder.find('foo/bar/baz', 'yarn.lock')).toBe('foo');

			setFileSystem({
				foo: {
					'yarn.lock': {},
					bar: {
						baz: {},
					},
				},
			});

			expect(await finder.find('foo/bar/baz', 'yarn.lock')).toBeUndefined();

			setFileSystem({
				'yarn.lock': {},
				foo: {
					bar: {
						baz: {},
					},
				},
			});

			expect(await finder.find('foo/bar/baz', 'yarn.lock')).toBeUndefined();
		});

		it('should throw when encountering a file system error other than ENOENT or ENOTDIR', async () => {
			setFileSystem({
				foo: {
					bar: {
						baz: createError('EACCES', 'foo/bar/baz', -13, 'stat'),
					},
				},
			});

			await expect(finder.find('foo/bar/baz', 'yarn.lock')).rejects.toThrowErrorMatchingSnapshot();
		});
	});
});
