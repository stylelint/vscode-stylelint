import cp from 'child_process';
import readline from 'readline';

/**
 * Runs a process and returns the output as read by the given matcher. The
 * matcher is called for each line of the output with the line. The promise
 * returned by this function is resolved to the first value returned by the
 * matcher once the process has exited.
 *
 * If the matcher returns `undefined`, the line is ignored.
 *
 * If the matcher never returns a value, the promise is resolved to `undefined`.
 *
 * If the matcher throws an error, the promise is rejected with the error and
 * an attempt is made to kill the process.
 *
 * If the process exits with a non-zero exit code or if the child process API
 * emits an error, the promise is rejected with the exit code or error.
 * @param command Shell command or path to executable
 * @param args Arguments to pass to the command
 * @param options Options to pass to the spawner
 * @param matcher Function to match the output line
 */
export function runProcessFindLine<T>(
	command: string,
	args: string[],
	options: cp.SpawnOptionsWithoutStdio | undefined,
	matcher: (line: string) => T | undefined,
): Promise<T | undefined> {
	return new Promise((resolve, reject) => {
		const childProcess = cp.spawn(command, args, options);

		const stdoutReader = readline.createInterface({
			input: childProcess.stdout,
		});

		let returnValue: T | undefined = undefined;
		let exitCode: number | NodeJS.Signals | null | undefined = undefined;
		let resolved = false;
		let streamClosed = false;

		const resolveOrRejectIfNeeded = (): void => {
			if (resolved || exitCode === undefined || !streamClosed) {
				return;
			}

			resolved = true;

			if (exitCode === 0) {
				resolve(returnValue);
			} else {
				reject(new Error(`Command "${command}" exited with code ${exitCode}.`));
			}
		};

		const handleError = (error: unknown): void => {
			resolved = true;
			childProcess.removeAllListeners();
			stdoutReader.close();

			try {
				childProcess.kill();
			} catch {
				// ignore
			}

			reject(error);
		};

		stdoutReader.on('line', (line) => {
			if (resolved || returnValue !== undefined) {
				return;
			}

			try {
				const matched = matcher(line);

				if (matched !== undefined) {
					returnValue = matched;
				}

				resolveOrRejectIfNeeded();
			} catch (error) {
				handleError(error);
			}
		});

		stdoutReader.on('close', () => {
			if (resolved) {
				return;
			}

			streamClosed = true;
			resolveOrRejectIfNeeded();
		});

		childProcess.on('error', handleError);

		childProcess.on('exit', (code, signal) => {
			exitCode = code ?? signal;

			resolveOrRejectIfNeeded();
		});
	});
}
