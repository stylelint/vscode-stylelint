jest.mock('child_process');

import cp from 'child_process';
import { runProcessFindLine } from '../processes';

const mockedChildProcess = cp as tests.mocks.ChildProcessModule;

describe('runProcessFindLine', () => {
	beforeAll(() => {
		mockedChildProcess.__mockProcess('foo', ['bar'], 0, 'from\nstdout');
		mockedChildProcess.__mockProcess('foo', ['baz'], 0, 'multi\nline\noutput\n');
		mockedChildProcess.__mockProcess('foo', ['qux'], 1, undefined, 'from\nstderr');
		mockedChildProcess.__mockProcess('foo', ['quz'], 'SIGHUP', undefined, 'from\nstderr');
	});

	it('should run the process and return the line when it is found', async () => {
		const result = await runProcessFindLine('foo', ['bar'], undefined, (line) =>
			line === 'stdout' ? `output: ${line}` : undefined,
		);

		expect(result).toBe('output: stdout');
	});

	it('should only return the first matched line', async () => {
		const result = await runProcessFindLine('foo', ['baz'], undefined, (line) => `output: ${line}`);

		expect(result).toBe('output: multi');
	});

	it('should throw an error when the process exits with a non-zero exit code', async () => {
		expect.assertions(1);

		await expect(
			runProcessFindLine('foo', ['qux'], undefined, (line) =>
				line === 'stdout' ? `output: ${line}` : undefined,
			),
		).rejects.toThrowErrorMatchingSnapshot();
	});

	it('should throw an error when the process exits due to a signal', async () => {
		expect.assertions(1);

		await expect(
			runProcessFindLine('foo', ['quz'], undefined, (line) =>
				line === 'stdout' ? `output: ${line}` : undefined,
			),
		).rejects.toThrowErrorMatchingSnapshot();
	});

	it('should throw an error if the command is not found', async () => {
		expect.assertions(1);

		await expect(
			runProcessFindLine('foo', ['quuz'], undefined, (line) =>
				line === 'stdout' ? `output: ${line}` : undefined,
			),
		).rejects.toThrowErrorMatchingSnapshot();
	});

	it('should throw an error if the matcher throws an error before the process exits', async () => {
		expect.assertions(1);

		await expect(
			runProcessFindLine('foo', ['bar'], undefined, () => {
				throw new Error('error');
			}),
		).rejects.toThrowErrorMatchingSnapshot();
	});
});
