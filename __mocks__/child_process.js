'use strict';

const stream = require('stream');
const { createError } = require('../test/mockSystemErrors');

const cp = jest.createMockFromModule('child_process');

/**
 * Mocks of processes.
 * @type {{
 *   [command: string]: {
 *   args: string[];
 *   exitCode: number | NodeJS.Signals;
 *   stdout?: string;
 *   stderr?: string;
 *   }[];
 * }}
 */
let processes = {};

/**
 * Resets the mocked processes.
 * @return {void}
 */
cp.__resetMockedProcesses = () => {
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
 * @param {number} exitDelay
 * @param {number} stdoutDelay
 * @param {number} stderrDelay
 * @param {number} errorDelay
 */
cp.__setDelay = (exitDelay = 0, stdoutDelay = 0, stderrDelay = 0, errorDelay = 0) => {
	delay.exit = exitDelay;
	delay.stdout = stdoutDelay;
	delay.stderr = stderrDelay;
	delay.error = errorDelay;
};

/**
 * Mocks a process.
 * @param {string} command
 * @param {string[]} args
 * @param {number | NodeJS.Signals} exitCode
 * @param {string} [stdout]
 * @param {string} [stderr]
 */
cp.__mockProcess = (command, args, exitCode, stdout, stderr) => {
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
 * @param {string} command
 * @param {string[]} args
 */
const findMockedProcess = (command, args) => {
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
 * @param {string} command
 * @param {string[]} args
 * @returns {tests.mocks.ChildProcessWithoutNullStreams}
 */
cp.spawn = (command, args) => {
	const variant = findMockedProcess(command, args);

	/** @type {Error} */
	let errorToEmit;

	if (!variant) {
		errorToEmit = createError('ENOENT', command, -4058, `spawn ${command}`);
	}

	/** @type {tests.mocks.ChildProcessWithoutNullStreams} */
	const childProcess = {
		removeAllListeners() {
			return childProcess;
		},

		kill() {},

		on(event, listener) {
			if (event === 'error') {
				if (errorToEmit) {
					if (delay.error) {
						setTimeout(() => {
							listener(errorToEmit);
						}, delay.error);
					} else {
						listener(errorToEmit);
					}
				}
			} else if (event === 'exit') {
				if (variant) {
					const handleExit = () => {
						if (typeof variant.exitCode === 'number') {
							listener(variant.exitCode);
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
};

module.exports = cp;
