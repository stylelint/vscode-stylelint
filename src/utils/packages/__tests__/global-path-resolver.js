'use strict';

jest.mock('path');
jest.mock('os');
jest.mock('../../processes');

/** @typedef {typeof import('../global-path-resolver').getGlobalPathResolver} getGlobalPathResolver */

/**
 * @param {'posix' | 'win32'} platform
 */
const mockPlatform = (platform) => {
	const mockedOS = /** @type {tests.mocks.OSModule} */ (require('os'));

	mockedOS.__mockPlatform(platform === 'win32' ? 'win32' : 'linux');

	const mockedPath = /** @type {tests.mocks.PathModule} */ (require('path'));

	mockedPath.__mockPlatform(platform);
};

describe('Global Package Manager Path Resolver', () => {
	describe('Non-Windows', () => {
		/** @type {getGlobalPathResolver} */
		let getGlobalPathResolver;

		beforeAll(() => {
			mockPlatform('posix');

			const mockedProcesses = /** @type {tests.mocks.Processes} */ (require('../../processes'));

			mockedProcesses.__resetMockedProcesses();

			mockedProcesses.__mockProcess(
				'yarn',
				['global', 'dir', '--json'],
				['{"type":"log","data":"/path/to/yarn/global/dir"}'],
			);

			mockedProcesses.__mockProcess(
				'npm',
				['config', 'get', 'prefix'],
				['/path/to/npm/global/dir'],
			);

			mockedProcesses.__mockProcess('pnpm', ['root', '-g'], ['/path/to/pnpm/global/dir']);

			getGlobalPathResolver = require('../global-path-resolver').getGlobalPathResolver;
		});

		it('should resolve the yarn global package directory', async () => {
			const resolver = getGlobalPathResolver();
			const globalPath = await resolver.resolve('yarn');

			expect(globalPath).toBe('/path/to/yarn/global/dir/node_modules');
		});

		it('should resolve the npm global package directory', async () => {
			const resolver = getGlobalPathResolver();
			const globalPath = await resolver.resolve('npm');

			expect(globalPath).toBe('/path/to/npm/global/dir/lib/node_modules');
		});

		it('should resolve the pnpm global package directory', async () => {
			const resolver = getGlobalPathResolver();
			const globalPath = await resolver.resolve('pnpm');

			expect(globalPath).toBe('/path/to/pnpm/global/dir');
		});
	});

	describe('Windows', () => {
		/** @type {getGlobalPathResolver} */
		let getGlobalPathResolver;

		beforeAll(() => {
			mockPlatform('win32');

			const mockedProcesses = /** @type {tests.mocks.Processes} */ (require('../../processes'));

			mockedProcesses.__resetMockedProcesses();

			mockedProcesses.__mockProcess(
				'yarn',
				['global', 'dir', '--json'],
				['{"type":"log","data":"C:\\\\path\\\\to\\\\yarn\\\\global\\\\dir"}'],
			);

			mockedProcesses.__mockProcess(
				'npm',
				['config', 'get', 'prefix'],
				['C:\\path\\to\\npm\\global\\dir'],
			);

			mockedProcesses.__mockProcess('pnpm', ['root', '-g'], ['C:\\path\\to\\pnpm\\global\\dir']);

			getGlobalPathResolver = require('../global-path-resolver').getGlobalPathResolver;
		});

		it('should resolve the yarn global package directory', async () => {
			const resolver = getGlobalPathResolver();
			const globalPath = await resolver.resolve('yarn');

			expect(globalPath).toBe('C:\\path\\to\\yarn\\global\\dir\\node_modules');
		});

		it('should resolve the npm global package directory', async () => {
			const resolver = getGlobalPathResolver();
			const globalPath = await resolver.resolve('npm');

			expect(globalPath).toBe('C:\\path\\to\\npm\\global\\dir\\node_modules');
		});

		it('should resolve the pnpm global package directory', async () => {
			const resolver = getGlobalPathResolver();
			const globalPath = await resolver.resolve('pnpm');

			expect(globalPath).toBe('C:\\path\\to\\pnpm\\global\\dir');
		});
	});

	describe('Caching', () => {
		/** @type {getGlobalPathResolver} */
		let getGlobalPathResolver;

		/** @type {tests.mocks.Processes} */
		let mockedProcesses;

		beforeAll(() => {
			mockPlatform('posix');

			mockedProcesses = /** @type {tests.mocks.Processes} */ (require('../../processes'));

			mockedProcesses.__resetMockedProcesses();

			mockedProcesses.__mockProcess(
				'yarn',
				['global', 'dir', '--json'],
				['{"type":"log","data":"/path/to/yarn/global/dir"}'],
			);

			mockedProcesses.__mockProcess(
				'npm',
				['config', 'get', 'prefix'],
				['/path/to/npm/global/dir'],
			);

			mockedProcesses.__mockProcess('pnpm', ['root', '-g'], ['/path/to/pnpm/global/dir']);

			getGlobalPathResolver = require('../global-path-resolver').getGlobalPathResolver;
		});

		beforeEach(() => {
			mockedProcesses.runProcessFindLine.mockClear();
		});

		it('should cache the yarn global package directory', async () => {
			const resolver = getGlobalPathResolver();
			const globalPath = await resolver.resolve('yarn');
			const globalPath2 = await resolver.resolve('yarn');

			expect(globalPath).toBe(globalPath2);
			expect(mockedProcesses.runProcessFindLine).toHaveBeenCalledTimes(1);
		});

		it('should cache the npm global package directory', async () => {
			const resolver = getGlobalPathResolver();
			const globalPath = await resolver.resolve('npm');
			const globalPath2 = await resolver.resolve('npm');

			expect(globalPath).toBe(globalPath2);
			expect(mockedProcesses.runProcessFindLine).toHaveBeenCalledTimes(1);
		});

		it('should cache the pnpm global package directory', async () => {
			const resolver = getGlobalPathResolver();
			const globalPath = await resolver.resolve('pnpm');
			const globalPath2 = await resolver.resolve('pnpm');

			expect(globalPath).toBe(globalPath2);
			expect(mockedProcesses.runProcessFindLine).toHaveBeenCalledTimes(1);
		});
	});

	describe('Error handling', () => {
		describe('Missing commands', () => {
			/** @type {getGlobalPathResolver} */
			let getGlobalPathResolver;

			beforeAll(() => {
				mockPlatform('posix');

				const mockedProcesses = /** @type {tests.mocks.Processes} */ (require('../../processes'));

				mockedProcesses.__resetMockedProcesses();

				getGlobalPathResolver = require('../global-path-resolver').getGlobalPathResolver;
			});

			it('should throw an error if yarn cannot be found', async () => {
				const resolver = getGlobalPathResolver();

				await expect(resolver.resolve('yarn')).rejects.toThrowErrorMatchingSnapshot();
			});

			it('should throw an error if npm cannot be found', async () => {
				const resolver = getGlobalPathResolver();

				await expect(resolver.resolve('npm')).rejects.toThrowErrorMatchingSnapshot();
			});

			it('should throw an error if pnpm cannot be found', async () => {
				const resolver = getGlobalPathResolver();

				await expect(resolver.resolve('pnpm')).rejects.toThrowErrorMatchingSnapshot();
			});
		});

		describe('Bad output', () => {
			/** @type {getGlobalPathResolver} */
			let getGlobalPathResolver;

			/** @type {tests.mocks.Processes} */
			let mockedProcesses;

			beforeAll(() => {
				mockPlatform('posix');

				mockedProcesses = /** @type {tests.mocks.Processes} */ (require('../../processes'));

				mockedProcesses.__resetMockedProcesses();

				mockedProcesses.__mockProcess('npm', ['config', 'get', 'prefix'], ['']);

				mockedProcesses.__mockProcess('pnpm', ['root', '-g'], ['']);

				getGlobalPathResolver = require('../global-path-resolver').getGlobalPathResolver;
			});

			it('should resolve to undefined for yarn', async () => {
				mockedProcesses.__mockProcess('yarn', ['global', 'dir', '--json'], ['{badjson']);
				let globalPath = await getGlobalPathResolver().resolve('yarn');

				expect(globalPath).toBeUndefined();

				mockedProcesses.__mockProcess('yarn', ['global', 'dir', '--json'], ['{"type":"notlog"}']);
				globalPath = await getGlobalPathResolver().resolve('yarn');

				expect(globalPath).toBeUndefined();

				mockedProcesses.__mockProcess('yarn', ['global', 'dir', '--json'], ['']);
				globalPath = await getGlobalPathResolver().resolve('yarn');

				expect(globalPath).toBeUndefined();
			});

			it('should resolve to undefined for npm', async () => {
				const resolver = getGlobalPathResolver();
				const globalPath = await resolver.resolve('npm');

				expect(globalPath).toBeUndefined();
			});

			it('should resolve to undefined for pnpm', async () => {
				const resolver = getGlobalPathResolver();
				const globalPath = await resolver.resolve('pnpm');

				expect(globalPath).toBeUndefined();
			});
		});

		describe('Non-zero exit codes', () => {
			/** @type {getGlobalPathResolver} */
			let getGlobalPathResolver;

			beforeAll(() => {
				const mockedOS = /** @type {tests.mocks.OSModule} */ (require('os'));

				mockedOS.__mockPlatform('linux');

				const mockedPath = /** @type {tests.mocks.PathModule} */ (require('path'));

				mockedPath.__mockPlatform('posix');

				const mockedProcesses = /** @type {tests.mocks.Processes} */ (require('../../processes'));

				mockedProcesses.__resetMockedProcesses();

				mockedProcesses.__mockProcess(
					'yarn',
					['global', 'dir', '--json'],
					['{"type":"log","data":"/path/to/yarn/global/dir"}'],
					1,
				);

				mockedProcesses.__mockProcess(
					'npm',
					['config', 'get', 'prefix'],
					['/path/to/npm/global/dir'],
					1,
				);

				mockedProcesses.__mockProcess('pnpm', ['root', '-g'], ['/path/to/pnpm/global/dir'], 1);

				getGlobalPathResolver = require('../global-path-resolver').getGlobalPathResolver;
			});

			it('should throw an error if yarn returns a non-zero exit code', async () => {
				const resolver = getGlobalPathResolver();

				await expect(resolver.resolve('yarn')).rejects.toThrowErrorMatchingSnapshot();
			});

			it('should throw an error if npm returns a non-zero exit code', async () => {
				const resolver = getGlobalPathResolver();

				await expect(resolver.resolve('npm')).rejects.toThrowErrorMatchingSnapshot();
			});

			it('should throw an error if pnpm returns a non-zero exit code', async () => {
				const resolver = getGlobalPathResolver();

				await expect(resolver.resolve('pnpm')).rejects.toThrowErrorMatchingSnapshot();
			});
		});

		describe('Unsupported package managers', () => {
			it('should resolve to undefined when passed an unsupported package manager name', async () => {
				const getGlobalPathResolver = require('../global-path-resolver').getGlobalPathResolver;

				const globalPath = await getGlobalPathResolver().resolve(
					/** @type {any} */ ('unsupported'),
				);

				expect(globalPath).toBeUndefined();
			});
		});
	});
});
