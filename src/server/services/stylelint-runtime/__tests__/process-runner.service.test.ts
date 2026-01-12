import { EventEmitter } from 'node:events';
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process';
import { Readable } from 'node:stream';
import { beforeAll, describe, expect, it } from 'vitest';

import { createError } from '../../../../../test/mockSystemErrors.js';
import { ProcessRunnerService } from '../process-runner.service';

type MockProcessConfig = {
	args: string[];
	exitCode: number | NodeJS.Signals;
	stdout?: string;
	stderr?: string;
};

class MockChildProcessModule {
	#processes = new Map<string, MockProcessConfig[]>();

	mockProcess(
		command: string,
		args: string[],
		exitCode: number | NodeJS.Signals,
		stdout?: string,
		stderr?: string,
	): void {
		const variants = this.#processes.get(command) ?? [];

		variants.push({ args: [...args], exitCode, stdout, stderr });
		this.#processes.set(command, variants);
	}

	spawn(
		command: string,
		args: string[],
		_options?: SpawnOptionsWithoutStdio,
	): ChildProcessWithoutNullStreams {
		const variant = this.#findVariant(command, args);
		const childProcess = new EventEmitter() as ChildProcessWithoutNullStreams & {
			stdout: Readable;
			stderr: Readable;
		};

		childProcess.stdout = this.#createStream(variant?.stdout);
		childProcess.stderr = this.#createStream(variant?.stderr);
		childProcess.kill = () => true;
		const originalRemoveAllListeners = childProcess.removeAllListeners.bind(childProcess);

		childProcess.removeAllListeners = (event?: string | symbol) => {
			originalRemoveAllListeners(event);

			return childProcess;
		};

		const emitExit = (): void => {
			if (!variant) {
				childProcess.emit('error', createError('ENOENT', command, -4058, `spawn ${command}`));

				return;
			}

			if (typeof variant.exitCode === 'number') {
				childProcess.emit('exit', variant.exitCode, null);
			} else {
				childProcess.emit('exit', null, variant.exitCode);
			}
		};

		childProcess.stdout.on('end', () => {
			setImmediate(emitExit);
		});

		if (!variant) {
			setImmediate(emitExit);
		}

		return childProcess;
	}

	#createStream(content?: string): Readable {
		const stream = new Readable({
			read() {
				if (content) {
					this.push(content);
				}

				this.push(null);
			},
		});

		return stream;
	}

	#findVariant(command: string, args: string[]): MockProcessConfig | undefined {
		const variants = this.#processes.get(command);

		if (!variants) {
			return undefined;
		}

		return variants.find(
			(variant) =>
				variant.args.length === args.length &&
				variant.args.every((arg, index) => arg === args[index]),
		);
	}
}

describe('runProcessFindLine', () => {
	const mockChildProcess = new MockChildProcessModule();
	const runner = new ProcessRunnerService({
		spawn: mockChildProcess.spawn.bind(mockChildProcess),
	} as Pick<typeof import('node:child_process'), 'spawn'>);

	beforeAll(() => {
		mockChildProcess.mockProcess('foo', ['bar'], 0, 'from\nstdout');
		mockChildProcess.mockProcess('foo', ['baz'], 0, 'multi\nline\noutput\n');
		mockChildProcess.mockProcess('foo', ['qux'], 1, undefined, 'from\nstderr');
		mockChildProcess.mockProcess('foo', ['quz'], 'SIGHUP', undefined, 'from\nstderr');
	});

	it('should run the process and return the line when it is found', async () => {
		const result = await runner.runFindLine('foo', ['bar'], undefined, (line) => {
			return line === 'stdout' ? `output: ${line}` : undefined;
		});

		expect(result).toBe('output: stdout');
	});

	it('should only return the first matched line', async () => {
		const result = await runner.runFindLine('foo', ['baz'], undefined, (line) => `output: ${line}`);

		expect(result).toBe('output: multi');
	});

	it('should throw an error when the process exits with a non-zero exit code', async () => {
		expect.assertions(1);

		await expect(
			runner.runFindLine('foo', ['qux'], undefined, (line) => {
				return line === 'stdout' ? `output: ${line}` : undefined;
			}),
		).rejects.toThrowErrorMatchingSnapshot();
	});

	it('should throw an error when the process exits due to a signal', async () => {
		expect.assertions(1);

		await expect(
			runner.runFindLine('foo', ['quz'], undefined, (line) => {
				return line === 'stdout' ? `output: ${line}` : undefined;
			}),
		).rejects.toThrowErrorMatchingSnapshot();
	});

	it('should throw an error if the command is not found', async () => {
		expect.assertions(1);

		await expect(
			runner.runFindLine('foo', ['quuz'], undefined, (line) => {
				return line === 'stdout' ? `output: ${line}` : undefined;
			}),
		).rejects.toThrowErrorMatchingSnapshot();
	});

	it('should throw an error if the matcher throws an error before the process exits', async () => {
		expect.assertions(1);

		await expect(
			runner.runFindLine('foo', ['bar'], undefined, () => {
				throw new Error('error');
			}),
		).rejects.toThrowErrorMatchingSnapshot();
	});
});
