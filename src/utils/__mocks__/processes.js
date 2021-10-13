'use strict';

const processes = jest.createMockFromModule('../processes');
const { createError } = require('../../../test/mockSystemErrors');

/**
 * Mocks of processes.
 * @type {{[command: string]: {args: string[], lines: string[], exitCode?: number}}}
 */
let mockProcessMap = {};

/**
 * Resets the mocked processes.
 * @return {void}
 */
processes.__resetMockedProcesses = () => {
	mockProcessMap = {};
};

/**
 * Mocks a process.
 * @param {string} command
 * @param {string[]} args
 * @param {string[]} lines
 * @param {number} [exitCode]
 */
processes.__mockProcess = (command, args, lines, exitCode) => {
	mockProcessMap[command] = {
		args,
		lines,
		exitCode,
	};
};

/**
 * Finds the mocked process for the given command and arguments. If none is
 * found, returns `undefined`.
 * @param {string} command
 * @param {string[]} args
 */
const findMockedProcess = (command, args) => {
	const process = mockProcessMap[command];

	if (!process || process.args.length !== args.length) {
		return undefined;
	}

	if (process.args.every((arg, index) => arg === args[index])) {
		return process;
	}

	return undefined;
};

/**
 * Mock implementation of the `utils.runProcessFindLine` function.
 * @template T
 * @param {string} command Shell command or path to executable
 * @param {string[]} args Arguments to pass to the command
 * @param {import('child_process').SpawnOptionsWithoutStdio | undefined} _options Options to pass to the spawner
 * @param {(line: string) => (T | undefined)} matcher Function to match the output line
 * @returns {Promise<T | undefined>}
 */
const runProcessFindLine = async (command, args, _options, matcher) => {
	const process = findMockedProcess(command, args);

	if (!process) {
		throw createError('ENOENT', command, -4058, `spawn ${command}`);
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
};

processes.runProcessFindLine = jest.fn(runProcessFindLine);

module.exports = processes;
