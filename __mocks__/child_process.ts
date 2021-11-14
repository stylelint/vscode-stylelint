import stream from 'stream';
import { createError } from '../test/mockSystemErrors';

const cp = jest.createMockFromModule<tests.mocks.ChildProcessModule>('child_process');

/**
 * Mocks of processes.
 */
let processes: {
	[command: string]: {
		args: string[];
		exitCode: number | NodeJS.Signals;
		stdout?: string;
		stderr?: string;
	}[];
} = {};

/**
 * Resets the mocked processes.
 */
cp.__resetMockedProcesses = (): void => {
	processes = {};
};

const delay = {
	exit: 0,
	stdout: 0,
	stderr: 0,
	error: 0,
};

/**
 * Sets timing of responses to listeners.
 */
cp.__setDelay = (exitDelay = 0, stdoutDelay = 0, stderrDelay = 0, errorDelay = 0) => {
	delay.exit = exitDelay;
	delay.stdout = stdoutDelay;
	delay.stderr = stderrDelay;
	delay.error = errorDelay;
};

/**
 * Mocks a process.
 */
cp.__mockProcess = (
	command: string,
	args: string[],
	exitCode: number | NodeJS.Signals,
	stdout: string,
	stderr: string,
) => {
	if (!processes[command]) {
		processes[command] = [];
	}

	processes[command].push({
		args,
		exitCode,
		stdout,
		stderr,
	});
};

/**
 * Finds the mocked process for the given command and arguments. If none is
 * found, returns `undefined`.
 */
const findMockedProcess = (command: string, args: string[]) => {
	const variants = processes[command];

	if (!variants) {
		return undefined;
	}

	for (const variant of variants) {
		if (variant.args.length !== args.length) {
			continue;
		}

		if (variant.args.every((arg, index) => arg === args[index])) {
			return variant;
		}
	}

	return undefined;
};

/**
 * Mock implementation of the `child_process.spawn` function.
 */
cp.spawn = ((command: string, args: string[]) => {
	const variant = findMockedProcess(command, args);

	let errorToEmit: Error;

	if (!variant) {
		errorToEmit = createError('ENOENT', command, -4058, `spawn ${command}`);
	}

	const childProcess: tests.mocks.ChildProcessWithoutNullStreams = {
		removeAllListeners() {
			return childProcess;
		},

		kill() {
			return true;
		},

		on(event, listener) {
			if (event === 'error') {
				if (errorToEmit) {
					if (delay.error) {
						setTimeout(() => {
							listener(errorToEmit, null);
						}, delay.error);
					} else {
						listener(errorToEmit, null);
					}
				}
			} else if (event === 'exit') {
				if (variant) {
					const handleExit = (): void => {
						if (typeof variant.exitCode === 'number') {
							listener(variant.exitCode, null);
						} else {
							listener(null, variant.exitCode);
						}
					};

					if (delay.exit) {
						setTimeout(handleExit, delay.exit);
					} else {
						handleExit();
					}
				}
			}

			return childProcess;
		},

		stdout: new stream.Readable({
			read() {
				if (delay.stdout) {
					setTimeout(() => {
						if (variant?.stdout) {
							this.push(variant.stdout);
						}

						this.push(null);
					}, delay.stdout);
				} else {
					if (variant?.stdout) {
						this.push(variant.stdout);
					}

					this.push(null);
				}
			},
		}),

		stderr: new stream.Readable({
			read() {
				if (delay.stderr) {
					setTimeout(() => {
						if (variant?.stderr) {
							this.push(variant.stderr);
						}

						this.push(null);
					}, delay.stderr);
				} else {
					if (variant?.stderr) {
						this.push(variant.stderr);
					}

					this.push(null);
				}
			},
		}),
	};

	return childProcess;
}) as unknown as typeof cp.spawn;

export = cp;
