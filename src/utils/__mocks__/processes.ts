import { createError } from '../../../test/mockSystemErrors';
import type { SpawnOptionsWithoutStdio } from 'child_process';

const processes = jest.createMockFromModule<tests.mocks.Processes>('../processes');

type MockProcess = {
	args: string[];
	lines: string[];
	exitCode?: number;
};

/**
 * Mocks of processes.
 */
let mockProcessMap: { [command: string]: MockProcess } = {};

/**
 * Resets the mocked processes.
 * @return {void}
 */
processes.__resetMockedProcesses = () => {
	mockProcessMap = {};
};

/**
 * Mocks a process.
 */
processes.__mockProcess = (command: string, args: string[], lines: string[], exitCode?: number) => {
	mockProcessMap[command] = {
		args,
		lines,
		exitCode,
	};
};

/**
 * Finds the mocked process for the given command and arguments. If none is
 * found, returns `undefined`.
 */
const findMockedProcess = (command: string, args: string[]): MockProcess | undefined => {
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
 * @param command Shell command or path to executable
 * @param args Arguments to pass to the command
 * @param _options Options to pass to the spawner
 * @param matcher Function to match the output line
 */
const runProcessFindLine = async <T>(
	command: string,
	args: string[],
	_options: SpawnOptionsWithoutStdio | undefined,
	matcher: (line: string) => T | undefined,
): Promise<T | undefined> => {
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

processes.runProcessFindLine = jest.fn(
	runProcessFindLine,
) as (typeof processes)['runProcessFindLine'];

module.exports = processes;
