import * as assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { commands, FileSystemError, Position, Uri, workspace, type WorkspaceFolder } from 'vscode';

import {
	closeAllEditors,
	getStylelintDiagnostics,
	openDocument,
	restoreFile,
	sleep,
	waitForDiagnostics,
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
async function waitForCrashAttempts(
	minAttempts: number,
	timeoutMs = 10000,
	signal?: AbortSignal,
): Promise<void> {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		if (signal?.aborted) {
			return;
		}

		const attempts = await readCrashStateAttempts();

		if (attempts >= minAttempts) {
			return;
		}

		await sleep(100, signal);
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
async function triggerCrashAttempts(desiredAttempts: number, signal?: AbortSignal) {
	let attempts = await readCrashStateAttempts();
	let fileIndex = 0;
	const deadline = Date.now() + crashAttemptDeadlineMs;

	while (attempts < desiredAttempts) {
		if (signal?.aborted) {
			return;
		}

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
			await waitForCrashAttempts(attempts + 1, crashAttemptTimeoutMs, signal);
		} catch (error) {
			// Allow individual attempts to time out so we can retry with the next document.
			if (!(error instanceof Error) || !error.message.startsWith('Timed out')) {
				throw error;
			}
		} finally {
			await closeAllEditors();
		}

		if (signal?.aborted) {
			return;
		}

		attempts = await readCrashStateAttempts();
		await sleep(500, signal);
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

/**
 * Attempts to get diagnostics by making edits, with retry logic. This helps
 * stabilize tests when the server may not be immediately ready.
 */
async function waitForDiagnosticsWithRetry(
	editor: Awaited<ReturnType<typeof openDocument>>,
	maxAttempts = 5,
	attemptTimeoutMs = 10000,
	signal?: AbortSignal,
): Promise<ReturnType<typeof getStylelintDiagnostics>> {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		if (signal?.aborted) {
			break;
		}

		// Make a unique edit to force a fresh lint.
		const editMarker = `/* retry attempt ${attempt} - ${Date.now()} */\n`;

		await editor.edit((builder) => {
			builder.insert(new Position(0, 0), editMarker);
		});
		await editor.document.save();

		try {
			const diagnostics = await waitForDiagnostics(editor, { timeout: attemptTimeoutMs });

			return diagnostics;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt < maxAttempts) {
				// Brief pause before retrying to let server stabilize.
				await sleep(500, signal);
			}
		}
	}

	throw lastError ?? new Error('Failed to get diagnostics after retries');
}

describe('Worker crash recovery', function workerCrashRecovery() {
	this.timeout(120000);

	restoreFile(targetFile);
	restoreFile('worker-crash/stylelint.config.js');

	let abortController: AbortController;

	beforeEach(async () => {
		abortController = new AbortController();
		await resetCrashState();
	});

	afterEach(async () => {
		abortController.abort();
		await closeAllEditors();
		await resetCrashState();
	});

	it('restores diagnostics after restarting the server', async () => {
		const { signal } = abortController;

		await triggerCrashAttempts(3, signal);
		await waitForCrashAttempts(3, 10000, signal);

		await openDocument(targetFile);
		await closeAllEditors();

		try {
			await commands.executeCommand('stylelint.restart');
		} catch (error) {
			if (!(error instanceof Error) || !error.message.includes('connection got disposed')) {
				throw error;
			}
		}

		await triggerConfigChange();
		const reopened = await openDocument(targetFile);

		const diagnostics = await waitForDiagnosticsWithRetry(reopened, 5, 10000, signal);
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
