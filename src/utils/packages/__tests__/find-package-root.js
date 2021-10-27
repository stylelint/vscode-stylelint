'use strict';

jest.mock('fs/promises');

const { createError } = require('../../../../test/mockSystemErrors');
const mockedFS = /** @type {tests.mocks.FSPromisesModule} */ (require('fs/promises'));
const findPackageRoot = require('../find-package-root').findPackageRoot;

describe('findPackageRoot', () => {
	describe('with defaults', () => {
		it('should resolve the package directory when package.json is present', async () => {
			mockedFS.__mockFileSystem({
				foo: {
					bar: {
						'package.json': '{}',
						baz: {},
					},
				},
			});

			expect(await findPackageRoot('foo/bar/baz')).toBe('foo/bar');
		});

		it('should resolve the package directory when the starting path points to a file', async () => {
			mockedFS.__mockFileSystem({
				foo: {
					bar: {
						'package.json': '{}',
						baz: '',
					},
				},
			});

			expect(await findPackageRoot('foo/bar/baz')).toBe('foo/bar');
		});

		it("should not resolve when package.json isn't in the tree", async () => {
			mockedFS.__mockFileSystem({
				foo: {
					bar: {
						baz: {},
					},
				},
			});

			expect(await findPackageRoot('foo/bar/baz')).toBeUndefined();
		});

		it('should not resolve folders with a directory named package.json', async () => {
			mockedFS.__mockFileSystem({
				foo: {
					'package.json': '{}',
					bar: {
						'package.json': {},
						baz: {},
					},
				},
			});

			expect(await findPackageRoot('foo/bar/baz')).toBe('foo');

			mockedFS.__mockFileSystem({
				foo: {
					'package.json': {},
					bar: {
						baz: {},
					},
				},
			});

			expect(await findPackageRoot('foo/bar/baz')).toBeUndefined();

			mockedFS.__mockFileSystem({
				'package.json': {},
				foo: {
					bar: {
						baz: {},
					},
				},
			});

			expect(await findPackageRoot('foo/bar/baz')).toBeUndefined();
		});

		it('should throw when encountering a file system error other than ENOENT', async () => {
			mockedFS.__mockFileSystem({
				foo: {
					bar: {
						baz: createError('EACCES', 'foo/bar/baz', -13, 'stat'),
					},
				},
			});

			await expect(findPackageRoot('foo/bar/baz')).rejects.toThrowErrorMatchingSnapshot();
		});
	});

	describe('with custom root file', () => {
		it('should resolve the package directory when the root file is present', async () => {
			mockedFS.__mockFileSystem({
				foo: {
					bar: {
						'yarn.lock': '',
						baz: {},
					},
				},
			});

			expect(await findPackageRoot('foo/bar/baz', 'yarn.lock')).toBe('foo/bar');
		});

		it('should resolve the package directory when the starting path points to a file', async () => {
			mockedFS.__mockFileSystem({
				foo: {
					bar: {
						'yarn.lock': '',
						baz: '',
					},
				},
			});

			expect(await findPackageRoot('foo/bar/baz', 'yarn.lock')).toBe('foo/bar');
		});

		it("should not resolve when the root file isn't in the tree", async () => {
			mockedFS.__mockFileSystem({
				foo: {
					bar: {
						baz: {},
					},
				},
			});

			expect(await findPackageRoot('foo/bar/baz', 'yarn.lock')).toBeUndefined();
		});

		it('should not resolve folders with a directory with the same name as the root file', async () => {
			mockedFS.__mockFileSystem({
				foo: {
					'yarn.lock': '',
					bar: {
						'yarn.lock': {},
						baz: {},
					},
				},
			});

			expect(await findPackageRoot('foo/bar/baz', 'yarn.lock')).toBe('foo');

			mockedFS.__mockFileSystem({
				foo: {
					'yarn.lock': {},
					bar: {
						baz: {},
					},
				},
			});

			expect(await findPackageRoot('foo/bar/baz', 'yarn.lock')).toBeUndefined();

			mockedFS.__mockFileSystem({
				'yarn.lock': {},
				foo: {
					bar: {
						baz: {},
					},
				},
			});

			expect(await findPackageRoot('foo/bar/baz', 'yarn.lock')).toBeUndefined();
		});

		it('should throw when encountering a file system error other than ENOENT', async () => {
			mockedFS.__mockFileSystem({
				foo: {
					bar: {
						baz: createError('EACCES', 'foo/bar/baz', -13, 'stat'),
					},
				},
			});

			await expect(
				findPackageRoot('foo/bar/baz', 'yarn.lock'),
			).rejects.toThrowErrorMatchingSnapshot();
		});
	});
});
