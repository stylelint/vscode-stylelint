jest.mock('path');
jest.mock('os');
jest.mock('../../processes');

import os from 'os';
import path from 'path';
import type winston from 'winston';
import * as processes from '../../processes';
import { GlobalPathResolver, PackageManager } from '../index';

const mockedOS = os as tests.mocks.OSModule;
const mockedPath = path as tests.mocks.PathModule;
const mockedProcesses = processes as tests.mocks.Processes;

const mockLogger = {
	debug: jest.fn(),
	error: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
} as unknown as jest.Mocked<winston.Logger>;

const mockPlatform = (platform: 'posix' | 'win32') => {
	mockedOS.__mockPlatform(platform === 'win32' ? 'win32' : 'linux');
	mockedPath.__mockPlatform(platform);
};

describe('Global Package Manager Path Resolver', () => {
	describe('Non-Windows', () => {
		beforeAll(() => {
			mockPlatform('posix');

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
		});

		it('should resolve the yarn global package directory', async () => {
			const resolver = new GlobalPathResolver();
			const globalPath = await resolver.resolve('yarn');

			expect(globalPath).toBe('/path/to/yarn/global/dir/node_modules');
		});

		it('should resolve the npm global package directory', async () => {
			const resolver = new GlobalPathResolver();
			const globalPath = await resolver.resolve('npm');

			expect(globalPath).toBe('/path/to/npm/global/dir/lib/node_modules');
		});

		it('should resolve the pnpm global package directory', async () => {
			const resolver = new GlobalPathResolver();
			const globalPath = await resolver.resolve('pnpm');

			expect(globalPath).toBe('/path/to/pnpm/global/dir');
		});
	});

	describe('Windows', () => {
		beforeAll(() => {
			mockPlatform('win32');

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
		});

		it('should resolve the yarn global package directory', async () => {
			const resolver = new GlobalPathResolver();
			const globalPath = await resolver.resolve('yarn');

			expect(globalPath).toBe('C:\\path\\to\\yarn\\global\\dir\\node_modules');
		});

		it('should resolve the npm global package directory', async () => {
			const resolver = new GlobalPathResolver();
			const globalPath = await resolver.resolve('npm');

			expect(globalPath).toBe('C:\\path\\to\\npm\\global\\dir\\node_modules');
		});

		it('should resolve the pnpm global package directory', async () => {
			const resolver = new GlobalPathResolver();
			const globalPath = await resolver.resolve('pnpm');

			expect(globalPath).toBe('C:\\path\\to\\pnpm\\global\\dir');
		});
	});

	describe('Caching', () => {
		beforeAll(() => {
			mockPlatform('posix');

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
		});

		beforeEach(() => {
			mockedProcesses.runProcessFindLine.mockClear();
		});

		it('should cache the yarn global package directory', async () => {
			const resolver = new GlobalPathResolver();
			const globalPath = await resolver.resolve('yarn');
			const globalPath2 = await resolver.resolve('yarn');

			expect(globalPath).toBe(globalPath2);
			expect(mockedProcesses.runProcessFindLine).toHaveBeenCalledTimes(1);
		});

		it('should cache the npm global package directory', async () => {
			const resolver = new GlobalPathResolver();
			const globalPath = await resolver.resolve('npm');
			const globalPath2 = await resolver.resolve('npm');

			expect(globalPath).toBe(globalPath2);
			expect(mockedProcesses.runProcessFindLine).toHaveBeenCalledTimes(1);
		});

		it('should cache the pnpm global package directory', async () => {
			const resolver = new GlobalPathResolver();
			const globalPath = await resolver.resolve('pnpm');
			const globalPath2 = await resolver.resolve('pnpm');

			expect(globalPath).toBe(globalPath2);
			expect(mockedProcesses.runProcessFindLine).toHaveBeenCalledTimes(1);
		});
	});

	describe('Error handling', () => {
		describe('Missing commands', () => {
			beforeAll(() => {
				mockPlatform('posix');

				mockedProcesses.__resetMockedProcesses();
			});

			beforeEach(() => {
				jest.clearAllMocks();
			});

			it('should resolve to undefined if yarn cannot be found', async () => {
				const resolver = new GlobalPathResolver(mockLogger);
				const globalPath = await resolver.resolve('yarn');

				expect(globalPath).toBeUndefined();
				expect(mockLogger.warn).toHaveBeenLastCalledWith(
					'Failed to resolve global node_modules path.',
					{
						packageManager: 'yarn',
						error: expect.any(Error),
					},
				);
			});

			it('should resolve to undefined if npm cannot be found', async () => {
				const resolver = new GlobalPathResolver(mockLogger);
				const globalPath = await resolver.resolve('npm');

				expect(globalPath).toBeUndefined();
				expect(mockLogger.warn).toHaveBeenLastCalledWith(
					'Failed to resolve global node_modules path.',
					{
						packageManager: 'npm',
						error: expect.any(Error),
					},
				);
			});

			it('should resolve to undefined if pnpm cannot be found', async () => {
				const resolver = new GlobalPathResolver(mockLogger);
				const globalPath = await resolver.resolve('pnpm');

				expect(globalPath).toBeUndefined();
				expect(mockLogger.warn).toHaveBeenLastCalledWith(
					'Failed to resolve global node_modules path.',
					{
						packageManager: 'pnpm',
						error: expect.any(Error),
					},
				);
			});
		});

		describe('Bad output', () => {
			beforeAll(() => {
				mockPlatform('posix');

				mockedProcesses.__resetMockedProcesses();

				mockedProcesses.__mockProcess('npm', ['config', 'get', 'prefix'], ['']);

				mockedProcesses.__mockProcess('pnpm', ['root', '-g'], ['']);
			});

			it('should resolve to undefined for yarn', async () => {
				mockedProcesses.__mockProcess('yarn', ['global', 'dir', '--json'], ['{bad json']);
				let globalPath = await new GlobalPathResolver().resolve('yarn');

				expect(globalPath).toBeUndefined();

				mockedProcesses.__mockProcess('yarn', ['global', 'dir', '--json'], ['{"type":"not log"}']);
				globalPath = await new GlobalPathResolver().resolve('yarn');

				expect(globalPath).toBeUndefined();

				mockedProcesses.__mockProcess('yarn', ['global', 'dir', '--json'], ['']);
				globalPath = await new GlobalPathResolver().resolve('yarn');

				expect(globalPath).toBeUndefined();
			});

			it('should resolve to undefined for npm', async () => {
				const resolver = new GlobalPathResolver();
				const globalPath = await resolver.resolve('npm');

				expect(globalPath).toBeUndefined();
			});

			it('should resolve to undefined for pnpm', async () => {
				const resolver = new GlobalPathResolver();
				const globalPath = await resolver.resolve('pnpm');

				expect(globalPath).toBeUndefined();
			});
		});

		describe('Non-zero exit codes', () => {
			beforeAll(() => {
				mockedOS.__mockPlatform('linux');
				mockedPath.__mockPlatform('posix');
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
			});

			it('should resolve to undefined if yarn returns a non-zero exit code', async () => {
				const resolver = new GlobalPathResolver(mockLogger);
				const globalPath = await resolver.resolve('yarn');

				expect(globalPath).toBeUndefined();
				expect(mockLogger.warn).toHaveBeenLastCalledWith(
					'Failed to resolve global node_modules path.',
					{
						packageManager: 'yarn',
						error: expect.any(Error),
					},
				);
			});

			it('should resolve to undefined if npm returns a non-zero exit code', async () => {
				const resolver = new GlobalPathResolver(mockLogger);
				const globalPath = await resolver.resolve('npm');

				expect(globalPath).toBeUndefined();
				expect(mockLogger.warn).toHaveBeenLastCalledWith(
					'Failed to resolve global node_modules path.',
					{
						packageManager: 'npm',
						error: expect.any(Error),
					},
				);
			});

			it('should resolve to undefined if pnpm returns a non-zero exit code', async () => {
				const resolver = new GlobalPathResolver(mockLogger);
				const globalPath = await resolver.resolve('pnpm');

				expect(globalPath).toBeUndefined();
				expect(mockLogger.warn).toHaveBeenLastCalledWith(
					'Failed to resolve global node_modules path.',
					{
						packageManager: 'pnpm',
						error: expect.any(Error),
					},
				);
			});
		});

		describe('Unsupported package managers', () => {
			it('should resolve to undefined when passed an unsupported package manager name', async () => {
				const globalPath = await new GlobalPathResolver().resolve(
					'unsupported' as unknown as PackageManager,
				);

				expect(globalPath).toBeUndefined();
			});
		});
	});
});
