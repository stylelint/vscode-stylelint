import type { SpawnOptionsWithoutStdio } from 'node:child_process';
import type os from 'node:os';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PackageManager } from '../../../stylelint/types.js';
import { GlobalPathResolverService } from '../global-path-resolver.service.js';
import { ProcessRunnerService } from '../process-runner.service.js';
import { createTestLogger, TestLogger } from '../../../../../test/helpers/test-logger.js';
import { createLoggingServiceStub } from '../../../../../test/helpers/index.js';
import { createContainer, module, provideTestValue } from '../../../../di/index.js';
import { OsModuleToken, PathModuleToken } from '../../../tokens.js';
import { loggingServiceToken } from '../../infrastructure/logging.service.js';

const mockLogger = createTestLogger();

type Matcher<T> = (line: string) => T | undefined;

type MockProcessConfig = {
	command: string;
	args: string[];
	lines: string[];
	exitCode?: number;
};

class FakeProcessRunner implements Pick<ProcessRunnerService, 'runFindLine'> {
	#processes = new Map<string, MockProcessConfig>();
	callCount = 0;

	async runFindLine<T>(
		command: string,
		args: string[],
		_options: SpawnOptionsWithoutStdio | undefined,
		matcher: Matcher<T>,
	): Promise<T | undefined> {
		this.callCount += 1;
		const process = this.#processes.get(this.#key(command, args));

		if (!process) {
			throw new Error(`Command "${command}" not configured.`);
		}

		if (process.exitCode !== undefined && process.exitCode !== 0) {
			throw new Error(`Command "${command}" exited with code ${process.exitCode}.`);
		}

		for (const line of process.lines) {
			const result = matcher(line);

			if (result !== undefined) {
				return result;
			}
		}

		return undefined;
	}

	mockProcess(command: string, args: string[], lines: string[], exitCode?: number): void {
		this.#processes.set(this.#key(command, args), {
			command,
			args: [...args],
			lines: [...lines],
			exitCode,
		});
	}

	reset(): void {
		this.#processes.clear();
		this.callCount = 0;
	}

	clearCalls(): void {
		this.callCount = 0;
	}

	#key(command: string, args: string[]): string {
		return `${command}|${args.join('|')}`;
	}
}

const createResolver = (
	platform: 'posix' | 'win32',
	runner: FakeProcessRunner,
	logger?: TestLogger,
) => {
	const osStub: Pick<typeof os, 'platform'> = {
		platform: () => (platform === 'win32' ? 'win32' : 'linux'),
	};
	const pathModule = platform === 'win32' ? path.win32 : path.posix;
	const loggingService = createLoggingServiceStub(logger ?? mockLogger);

	const container = createContainer(
		module({
			register: [
				provideTestValue(OsModuleToken, () => osStub),
				provideTestValue(PathModuleToken, () => pathModule),
				provideTestValue(ProcessRunnerService, () => runner as unknown as ProcessRunnerService),
				provideTestValue(loggingServiceToken, () => loggingService),
				GlobalPathResolverService,
			],
		}),
	);

	return container.resolve(GlobalPathResolverService);
};

describe('Global Package Manager Path Resolver', () => {
	describe('Non-Windows', () => {
		const runner = new FakeProcessRunner();
		let resolver: GlobalPathResolverService;
		let resolveService: () => GlobalPathResolverService;

		beforeAll(() => {
			runner.reset();

			runner.mockProcess(
				'yarn',
				['global', 'dir', '--json'],
				['{"type":"log","data":"/path/to/yarn/global/dir"}'],
			);

			runner.mockProcess('npm', ['config', 'get', 'prefix'], ['/path/to/npm/global/dir']);

			runner.mockProcess('pnpm', ['root', '-g'], ['/path/to/pnpm/global/dir']);
		});

		beforeEach(() => {
			resolveService = () => createResolver('posix', runner);
			resolver = resolveService();
		});

		it('should resolve the yarn global package directory', async () => {
			const globalPath = await resolver.resolve('yarn');

			expect(globalPath).toBe('/path/to/yarn/global/dir/node_modules');
		});

		it('should resolve the npm global package directory', async () => {
			const globalPath = await resolver.resolve('npm');

			expect(globalPath).toBe('/path/to/npm/global/dir/lib/node_modules');
		});

		it('should resolve the pnpm global package directory', async () => {
			const globalPath = await resolver.resolve('pnpm');

			expect(globalPath).toBe('/path/to/pnpm/global/dir');
		});
	});

	describe('Windows', () => {
		const runner = new FakeProcessRunner();
		let resolver: GlobalPathResolverService;
		let resolveService: () => GlobalPathResolverService;

		beforeAll(() => {
			runner.reset();

			runner.mockProcess(
				'yarn',
				['global', 'dir', '--json'],
				['{"type":"log","data":"C:\\\\path\\\\to\\\\yarn\\\\global\\\\dir"}'],
			);

			runner.mockProcess('npm', ['config', 'get', 'prefix'], ['C:\\path\\to\\npm\\global\\dir']);

			runner.mockProcess('pnpm', ['root', '-g'], ['C:\\path\\to\\pnpm\\global\\dir']);
		});

		beforeEach(() => {
			resolveService = () => createResolver('win32', runner);
			resolver = resolveService();
		});

		it('should resolve the yarn global package directory', async () => {
			const globalPath = await resolver.resolve('yarn');

			expect(globalPath).toBe('C:\\path\\to\\yarn\\global\\dir\\node_modules');
		});

		it('should resolve the npm global package directory', async () => {
			const globalPath = await resolver.resolve('npm');

			expect(globalPath).toBe('C:\\path\\to\\npm\\global\\dir\\node_modules');
		});

		it('should resolve the pnpm global package directory', async () => {
			const globalPath = await resolver.resolve('pnpm');

			expect(globalPath).toBe('C:\\path\\to\\pnpm\\global\\dir');
		});
	});

	describe('Caching', () => {
		const runner = new FakeProcessRunner();
		let resolver: GlobalPathResolverService;
		let resolveService: () => GlobalPathResolverService;

		beforeAll(() => {
			runner.reset();

			runner.mockProcess(
				'yarn',
				['global', 'dir', '--json'],
				['{"type":"log","data":"/path/to/yarn/global/dir"}'],
			);

			runner.mockProcess('npm', ['config', 'get', 'prefix'], ['/path/to/npm/global/dir']);

			runner.mockProcess('pnpm', ['root', '-g'], ['/path/to/pnpm/global/dir']);
		});

		beforeEach(() => {
			runner.clearCalls();
			resolveService = () => createResolver('posix', runner);
			resolver = resolveService();
		});

		it('should cache the yarn global package directory', async () => {
			const globalPath = await resolver.resolve('yarn');
			const globalPath2 = await resolver.resolve('yarn');

			expect(globalPath).toBe(globalPath2);
			expect(runner.callCount).toBe(1);
		});

		it('should cache the npm global package directory', async () => {
			const globalPath = await resolver.resolve('npm');
			const globalPath2 = await resolver.resolve('npm');

			expect(globalPath).toBe(globalPath2);
			expect(runner.callCount).toBe(1);
		});

		it('should cache the pnpm global package directory', async () => {
			const globalPath = await resolver.resolve('pnpm');
			const globalPath2 = await resolver.resolve('pnpm');

			expect(globalPath).toBe(globalPath2);
			expect(runner.callCount).toBe(1);
		});
	});

	describe('Error handling', () => {
		describe('Missing commands', () => {
			const runner = new FakeProcessRunner();
			let resolver: GlobalPathResolverService;
			let resolveService: () => GlobalPathResolverService;

			beforeAll(() => {
				runner.reset();
			});

			beforeEach(() => {
				runner.reset();
				vi.clearAllMocks();
				resolveService = () => createResolver('posix', runner, mockLogger);
				resolver = resolveService();
			});

			it('should resolve to undefined if yarn cannot be found', async () => {
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
			const runner = new FakeProcessRunner();
			let resolver: GlobalPathResolverService;
			let resolveService: () => GlobalPathResolverService;

			beforeAll(() => {
				runner.reset();

				runner.mockProcess('npm', ['config', 'get', 'prefix'], ['']);

				runner.mockProcess('pnpm', ['root', '-g'], ['']);
			});

			beforeEach(() => {
				resolveService = () => createResolver('posix', runner);
				resolver = resolveService();
			});

			it('should resolve to undefined for yarn', async () => {
				runner.mockProcess('yarn', ['global', 'dir', '--json'], ['{bad json']);
				let globalPath = await resolveService().resolve('yarn');

				expect(globalPath).toBeUndefined();

				runner.mockProcess('yarn', ['global', 'dir', '--json'], ['{"type":"not log"}']);
				globalPath = await resolveService().resolve('yarn');

				expect(globalPath).toBeUndefined();

				runner.mockProcess('yarn', ['global', 'dir', '--json'], ['']);
				globalPath = await resolveService().resolve('yarn');

				expect(globalPath).toBeUndefined();
			});

			it('should resolve to undefined for npm', async () => {
				const globalPath = await resolver.resolve('npm');

				expect(globalPath).toBeUndefined();
			});

			it('should resolve to undefined for pnpm', async () => {
				const globalPath = await resolver.resolve('pnpm');

				expect(globalPath).toBeUndefined();
			});
		});

		describe('Non-zero exit codes', () => {
			const runner = new FakeProcessRunner();
			let resolver: GlobalPathResolverService;
			let resolveService: () => GlobalPathResolverService;

			beforeAll(() => {
				runner.reset();

				runner.mockProcess(
					'yarn',
					['global', 'dir', '--json'],
					['{"type":"log","data":"/path/to/yarn/global/dir"}'],
					1,
				);

				runner.mockProcess('npm', ['config', 'get', 'prefix'], ['/path/to/npm/global/dir'], 1);

				runner.mockProcess('pnpm', ['root', '-g'], ['/path/to/pnpm/global/dir'], 1);
			});

			beforeEach(() => {
				vi.clearAllMocks();
				resolveService = () => createResolver('posix', runner, mockLogger);
				resolver = resolveService();
			});

			it('should resolve to undefined if yarn returns a non-zero exit code', async () => {
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
			let resolver: GlobalPathResolverService;

			beforeEach(() => {
				resolver = createResolver('posix', new FakeProcessRunner());
			});

			it('should resolve to undefined when passed an unsupported package manager name', async () => {
				const globalPath = await resolver.resolve('unsupported' as unknown as PackageManager);

				expect(globalPath).toBeUndefined();
			});
		});
	});
});
