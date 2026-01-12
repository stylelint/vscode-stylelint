import * as assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

import { commands, FileSystemError, Position, Uri, workspace, type WorkspaceFolder } from 'vscode';

import {
	closeAllEditors,
	openDocument,
	restoreFile,
	sleep,
	waitForDiagnostics,
	waitForDiagnosticsLength,
} from '../helpers.js';

const workspaceName = 'worker-crash';
const targetFile = 'worker-crash/crash.css';
const stateFile = '.stylelint-worker-crash-state.json';
const crashAttemptTimeoutMs = 20000;
const crashAttemptDeadlineMs = 2 * 60 * 1000;

/**
 * Gets the workspace folder for crash tests.
 */
function getCrashWorkspaceFolder(): WorkspaceFolder {
	const folder = workspace.workspaceFolders?.find((entry) => entry.name === workspaceName);

	assert.ok(folder, `Workspace folder "${workspaceName}" not found`);

	return folder;
}

/**
 * Get the path to the crash state file.
 */
function getCrashStatePath(): string {
	return path.join(getCrashWorkspaceFolder().uri.fsPath, stateFile);
}

/**
 * Determines whether the provided error is an `ErrnoException`.
 */
function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
	return typeof error === 'object' && error !== null && 'code' in error;
}

/**
 * Reads the number of recorded crash attempts.
 */
async function readCrashStateAttempts(): Promise<number> {
	try {
		const raw = await fs.readFile(getCrashStatePath(), 'utf8');
		const parsed = JSON.parse(raw) as { attempts?: number };

		return typeof parsed.attempts === 'number' ? parsed.attempts : 0;
	} catch (error) {
		if (
			(isErrnoException(error) && error.code === 'ENOENT') ||
			(error instanceof FileSystemError && error.code === 'FileNotFound')
		) {
			return 0;
		}

		throw error;
	}
}

/**
 * Waits until the specified number of crash attempts have been recorded.
 */
async function waitForCrashAttempts(minAttempts: number, timeoutMs = 10000): Promise<void> {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		const attempts = await readCrashStateAttempts();

		if (attempts >= minAttempts) {
			return;
		}

		await sleep(100);
	}

	throw new Error(`Timed out waiting for ${minAttempts} crash attempts`);
}

/**
 * Resets the crash state file.
 */
async function resetCrashState() {
	try {
		await fs.rm(getCrashStatePath(), { force: true });
	} catch (error) {
		if (
			(isErrnoException(error) && error.code === 'ENOENT') ||
			(error instanceof FileSystemError && error.code === 'FileNotFound')
		) {
			return;
		}

		throw error;
	}
}

const crashTriggerFiles = [
	'worker-crash/crash.css',
	'worker-crash/crash-second.css',
	'worker-crash/crash-third.css',
];

/**
 * Triggers crash attempts until the desired number is reached.
 */
async function triggerCrashAttempts(desiredAttempts: number) {
	let attempts = await readCrashStateAttempts();
	let fileIndex = 0;
	const deadline = Date.now() + crashAttemptDeadlineMs;

	while (attempts < desiredAttempts) {
		if (Date.now() >= deadline) {
			throw new Error(
				`Timed out forcing ${desiredAttempts} crash attempts (last recorded: ${attempts})`,
			);
		}

		const currentTargetFile = crashTriggerFiles[fileIndex];

		if (!currentTargetFile) {
			throw new Error('Unable to determine crash trigger file');
		}

		fileIndex = (fileIndex + 1) % crashTriggerFiles.length;

		await openDocument(currentTargetFile);

		try {
			await waitForCrashAttempts(attempts + 1, crashAttemptTimeoutMs);
		} catch (error) {
			// Allow individual attempts to time out so we can retry with the next document.
			if (!(error instanceof Error) || !error.message.startsWith('Timed out')) {
				throw error;
			}
		} finally {
			await closeAllEditors();
		}

		attempts = await readCrashStateAttempts();
		await sleep(500);
	}
}

/**
 * Triggers a configuration change to prompt the server to restart.
 */
async function triggerConfigChange(): Promise<void> {
	const configUri = Uri.joinPath(getCrashWorkspaceFolder().uri, 'stylelint.config.js');
	const original = await workspace.fs.readFile(configUri);
	const marker = Buffer.from('\n// restart trigger\n');

	await workspace.fs.writeFile(configUri, Buffer.concat([original, marker]));
	await sleep(100);
	await workspace.fs.writeFile(configUri, original);
}

const isCI = Boolean(process.env.CI);
const describeWorkerCrash = isCI ? describe.skip : describe;

describeWorkerCrash('Worker crash recovery', () => {
	restoreFile(targetFile);
	restoreFile('worker-crash/stylelint.config.js');

	beforeEach(async () => {
		await resetCrashState();
	});

	afterEach(async () => {
		await closeAllEditors();
		await resetCrashState();
	});

	it('restores diagnostics after restarting the server', async () => {
		await triggerCrashAttempts(3);
		await waitForCrashAttempts(3);

		const editor = await openDocument(targetFile);

		await waitForDiagnosticsLength(editor.document.uri, 0, { timeout: 20000 });
		await closeAllEditors();
		await sleep(500);

		try {
			await commands.executeCommand('stylelint.restart');
		} catch (error) {
			if (!(error instanceof Error) || !error.message.includes('connection got disposed')) {
				throw error;
			}
		}

		await sleep(500);
		await triggerConfigChange();
		const reopened = await openDocument(targetFile);

		await waitForDiagnosticsLength(reopened.document.uri, 0, { timeout: 20000 });
		await sleep(1000);
		await reopened.edit((builder) => {
			builder.insert(new Position(0, 0), '/* restart trigger */\n');
		});
		await reopened.document.save();
		const diagnostics = await waitForDiagnostics(reopened, { timeout: 20000 });
		const diagnostic = diagnostics[0];

		assert.ok(diagnostic, 'Expected Stylelint diagnostic after worker recovery');
		assert.equal(diagnostic.code, 'stylelint-crash/force-worker-crash');
		assert.ok(
			diagnostic.message.includes('(stylelint-crash/force-worker-crash)'),
			'Expected recovery message to include rule reference',
		);
		const recoveryMatch = /Worker recovered after (\d+) attempts/.exec(diagnostic.message);

		assert.ok(recoveryMatch, 'Expected recovery message to include attempt count');
		const recoveryAttempts = Number.parseInt(recoveryMatch[1], 10);

		assert.ok(
			recoveryAttempts >= 4,
			`Expected worker recovery to take at least 4 attempts (received ${recoveryAttempts})`,
		);
	});
});
