import * as assert from 'node:assert/strict';
import { promises as fs, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

import {
	commands,
	FileSystemError,
	languages,
	Position,
	Uri,
	window,
	workspace,
	type WorkspaceFolder,
} from 'vscode';

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

// CI-only diagnostic infrastructure
//
// All diagnostic output is gated behind the CI environment variable so that
// local test runs remain clean. On CI, every significant phase of the test
// emits a timestamped log line with structured data so that we can trace
// exactly where a hang or timeout occurs on slower Windows runners.

const IS_CI = Boolean(process.env.CI);
const DIAG_LOG_FILE = '.stylelint-worker-crash-diag.log';
const SERVER_DIAG_LOG_FILE = '.stylelint-server-diag.log';
let suiteStartMs = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

/**
 * Logs a timestamped diagnostic message. Only produces output when the CI
 * environment variable is set.
 */
function ciLog(message: string, data?: Record<string, unknown>): void {
	if (!IS_CI) return;

	const elapsed = suiteStartMs ? Date.now() - suiteStartMs : 0;
	const ts = new Date().toISOString();
	const suffix = data !== undefined ? ` | ${JSON.stringify(data)}` : '';

	console.error(`[worker-crash-diag ${ts} +${elapsed}ms] ${message}${suffix}`);
}

/**
 * Reads the crash-state file synchronously and returns its raw content.
 */
function ciReadStateFileSync(): string {
	try {
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		return readFileSync(getCrashStatePath(), 'utf8');
	} catch (e: unknown) {
		return `<error: ${e instanceof Error ? e.message : String(e)}>`;
	}
}

/**
 * Reads the plugin-side diagnostic log (written by the crash plugin on CI).
 */
function ciReadPluginLog(): string {
	try {
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		const logPath = path.join(getCrashWorkspaceFolder().uri.fsPath, DIAG_LOG_FILE);
		const content = readFileSync(logPath, 'utf8');

		if (content.length > 4000) {
			return `...(truncated ${content.length - 4000} chars)...\n${content.slice(-4000)}`;
		}

		return content;
	} catch (e: unknown) {
		return `<error: ${e instanceof Error ? e.message : String(e)}>`;
	}
}

/**
 * Reads the server-side diagnostic log (written by worker-process.ts and
 * worker-registry.service.ts on CI).
 */
function ciReadServerLog(): string {
	try {
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		const logPath = path.join(getCrashWorkspaceFolder().uri.fsPath, SERVER_DIAG_LOG_FILE);
		const content = readFileSync(logPath, 'utf8');

		if (content.length > 8000) {
			return `...(truncated ${content.length - 8000} chars)...\n${content.slice(-8000)}`;
		}

		return content;
	} catch (e: unknown) {
		return `<error: ${e instanceof Error ? e.message : String(e)}>`;
	}
}

/**
 * Returns stat metadata for the crash-state file, or a descriptive error.
 */
function ciStateFileStat(): string {
	try {
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		const s = statSync(getCrashStatePath());

		return JSON.stringify({ size: s.size, mtimeMs: Math.round(s.mtimeMs) });
	} catch {
		return '<not found>';
	}
}

/**
 * Collects and logs a comprehensive snapshot of the current test state.
 */
function ciDumpState(label: string): void {
	if (!IS_CI) return;

	// Editor state.
	const activeUri = window.activeTextEditor?.document.uri.toString() ?? '<none>';
	const visibleUris = window.visibleTextEditors.map((e) => e.document.uri.toString());

	// Diagnostics for all crash-workspace files.
	const allDiags = languages.getDiagnostics();
	const crashDiags: Record<
		string,
		{ source: string | undefined; code: string | number; msg: string }[]
	> = {};

	for (const [uri, diags] of allDiags) {
		if (!uri.fsPath.includes('worker-crash')) continue;

		crashDiags[path.basename(uri.fsPath)] = diags.map((d) => ({
			source: d.source,
			code: typeof d.code === 'object' && d.code !== null ? d.code.value : (d.code ?? ''),
			msg: d.message.slice(0, 150),
		}));
	}

	ciLog(`=== STATE DUMP: ${label} ===`, {
		crashStateRaw: ciReadStateFileSync(),
		stateFileStat: ciStateFileStat(),
		activeEditor: activeUri,
		visibleEditors: visibleUris,
		crashDiagnostics: crashDiags,
	});

	// Plugin log separately since it can be multi-line.
	const pluginLog = ciReadPluginLog();

	if (!pluginLog.startsWith('<error')) {
		ciLog(`Plugin log (${label}):\n${pluginLog}`);
	}

	// Server-side diagnostic log (worker-process.ts + worker-registry.service.ts).
	const serverLog = ciReadServerLog();

	if (!serverLog.startsWith('<error')) {
		ciLog(`Server log (${label}):\n${serverLog}`);
	}
}

/**
 * Starts a periodic heartbeat that dumps state every {@link intervalMs}
 * milliseconds. Helps identify whether the process is alive but stuck.
 */
function ciStartHeartbeat(intervalMs = 5000): void {
	if (!IS_CI) return;

	heartbeatTimer = setInterval(() => {
		ciDumpState('heartbeat');
	}, intervalMs);
}

/**
 * Stops the CI heartbeat timer.
 */
function ciStopHeartbeat(): void {
	if (heartbeatTimer !== undefined) {
		clearInterval(heartbeatTimer);
		heartbeatTimer = undefined;
	}
}

/**
 * Removes the plugin-side and server-side diagnostic log files.
 */
async function resetDiagLog(): Promise<void> {
	try {
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		const wsPath = getCrashWorkspaceFolder().uri.fsPath;

		await fs.rm(path.join(wsPath, DIAG_LOG_FILE), { force: true });
		await fs.rm(path.join(wsPath, SERVER_DIAG_LOG_FILE), { force: true });
	} catch {
		// ignore
	}
}

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
		const attempts = typeof parsed.attempts === 'number' ? parsed.attempts : 0;

		ciLog('readCrashStateAttempts', { raw, attempts });

		return attempts;
	} catch (error) {
		if (
			(isErrnoException(error) && error.code === 'ENOENT') ||
			(error instanceof FileSystemError && error.code === 'FileNotFound')
		) {
			ciLog('readCrashStateAttempts: state file not found, returning 0');

			return 0;
		}

		ciLog('readCrashStateAttempts: unexpected error', {
			error: error instanceof Error ? error.message : String(error),
		});
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
	let lastLoggedAt = startedAt;
	let pollCount = 0;

	ciLog(`waitForCrashAttempts: waiting for >= ${minAttempts} attempts (timeout=${timeoutMs}ms)`);

	while (Date.now() - startedAt < timeoutMs) {
		if (signal?.aborted) {
			ciLog('waitForCrashAttempts: aborted by signal');

			return;
		}

		const attempts = await readCrashStateAttempts();

		pollCount++;

		// Log progress every 2 seconds to avoid flooding.
		const now = Date.now();

		if (now - lastLoggedAt >= 2000) {
			ciLog('waitForCrashAttempts: polling', {
				currentAttempts: attempts,
				minAttempts,
				pollCount,
				elapsedMs: now - startedAt,
				stateFileStat: ciStateFileStat(),
			});
			lastLoggedAt = now;
		}

		if (attempts >= minAttempts) {
			ciLog(`waitForCrashAttempts: target reached`, {
				attempts,
				elapsedMs: Date.now() - startedAt,
				pollCount,
			});

			return;
		}

		await sleep(100, signal);
	}

	ciLog('waitForCrashAttempts: TIMED OUT', {
		minAttempts,
		timeoutMs,
		pollCount,
		stateFileContent: ciReadStateFileSync(),
		stateFileStat: ciStateFileStat(),
	});
	ciDumpState('waitForCrashAttempts-timeout');
	throw new Error(`Timed out waiting for ${minAttempts} crash attempts`);
}

/**
 * Resets the crash state file and the plugin diagnostic log.
 */
async function resetCrashState() {
	ciLog('resetCrashState: removing state file and diagnostic log');

	try {
		await fs.rm(getCrashStatePath(), { force: true });
	} catch (error) {
		if (
			(isErrnoException(error) && error.code === 'ENOENT') ||
			(error instanceof FileSystemError && error.code === 'FileNotFound')
		) {
			// File already gone.
		} else {
			throw error;
		}
	}

	await resetDiagLog();
	ciLog('resetCrashState: done');
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
	const phaseStart = Date.now();
	let attempts = await readCrashStateAttempts();
	let fileIndex = 0;
	let iteration = 0;
	const deadline = Date.now() + crashAttemptDeadlineMs;

	ciLog(`triggerCrashAttempts: START`, {
		desiredAttempts,
		initialAttempts: attempts,
		deadlineMs: crashAttemptDeadlineMs,
	});

	while (attempts < desiredAttempts) {
		iteration++;

		if (signal?.aborted) {
			ciLog('triggerCrashAttempts: aborted by signal', { iteration, attempts });

			return;
		}

		const remaining = deadline - Date.now();

		if (remaining <= 0) {
			ciLog('triggerCrashAttempts: DEADLINE EXCEEDED', {
				iteration,
				attempts,
				desiredAttempts,
				elapsedMs: Date.now() - phaseStart,
			});
			ciDumpState('triggerCrashAttempts-deadline');
			throw new Error(
				`Timed out forcing ${desiredAttempts} crash attempts (last recorded: ${attempts})`,
			);
		}

		const currentTargetFile = crashTriggerFiles[fileIndex];

		if (!currentTargetFile) {
			throw new Error('Unable to determine crash trigger file');
		}

		fileIndex = (fileIndex + 1) % crashTriggerFiles.length;

		ciLog(`triggerCrashAttempts: iteration ${iteration}`, {
			file: currentTargetFile,
			currentAttempts: attempts,
			remainingMs: remaining,
		});

		const openStart = Date.now();

		await openDocument(currentTargetFile);
		ciLog(`triggerCrashAttempts: openDocument completed`, {
			file: currentTargetFile,
			durationMs: Date.now() - openStart,
			activeEditor: window.activeTextEditor?.document.uri.toString() ?? '<none>',
		});

		const waitStart = Date.now();

		try {
			await waitForCrashAttempts(attempts + 1, crashAttemptTimeoutMs, signal);
			ciLog(`triggerCrashAttempts: waitForCrashAttempts succeeded`, {
				iteration,
				durationMs: Date.now() - waitStart,
			});
		} catch (error) {
			// Allow individual attempts to time out so we can retry with the next document.
			if (!(error instanceof Error) || !error.message.startsWith('Timed out')) {
				throw error;
			}

			ciLog(`triggerCrashAttempts: attempt timed out, will retry`, {
				iteration,
				waitDurationMs: Date.now() - waitStart,
				timeoutMs: crashAttemptTimeoutMs,
			});
		} finally {
			const closeStart = Date.now();

			await closeAllEditors();
			ciLog(`triggerCrashAttempts: closeAllEditors completed`, {
				durationMs: Date.now() - closeStart,
			});
		}

		if (signal?.aborted) {
			ciLog('triggerCrashAttempts: aborted by signal after close', { iteration });

			return;
		}

		attempts = await readCrashStateAttempts();
		ciLog(`triggerCrashAttempts: post-iteration state`, {
			iteration,
			attempts,
			desiredAttempts,
			iterationDurationMs: Date.now() - openStart,
		});
		await sleep(500, signal);
	}

	ciLog('triggerCrashAttempts: DONE', {
		totalIterations: iteration,
		finalAttempts: attempts,
		totalDurationMs: Date.now() - phaseStart,
	});
}

/**
 * Triggers a configuration change to prompt the server to restart.
 */
async function triggerConfigChange(): Promise<void> {
	const start = Date.now();

	ciLog('triggerConfigChange: START');
	const configUri = Uri.joinPath(getCrashWorkspaceFolder().uri, 'stylelint.config.js');
	const original = await workspace.fs.readFile(configUri);
	const marker = Buffer.from('\n// restart trigger\n');

	ciLog('triggerConfigChange: writing modified config', { configUri: configUri.toString() });
	await workspace.fs.writeFile(configUri, Buffer.concat([original, marker]));
	await sleep(100);
	ciLog('triggerConfigChange: restoring original config');
	await workspace.fs.writeFile(configUri, original);
	ciLog('triggerConfigChange: DONE', { durationMs: Date.now() - start });
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
	const phaseStart = Date.now();

	ciLog('waitForDiagnosticsWithRetry: START', {
		maxAttempts,
		attemptTimeoutMs,
		documentUri: editor.document.uri.toString(),
		documentVersion: editor.document.version,
		documentLineCount: editor.document.lineCount,
		existingDiagnostics: getStylelintDiagnostics(editor.document.uri).map((d) => ({
			code: typeof d.code === 'object' && d.code !== null ? d.code.value : d.code,
			msg: d.message.slice(0, 100),
		})),
	});

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		if (signal?.aborted) {
			ciLog('waitForDiagnosticsWithRetry: aborted by signal', { attempt });
			break;
		}

		// Make a unique edit to force a fresh lint.
		const editMarker = `/* retry attempt ${attempt} - ${Date.now()} */\n`;

		ciLog(`waitForDiagnosticsWithRetry: attempt ${attempt}/${maxAttempts}`, {
			editMarker: editMarker.trim(),
			documentVersion: editor.document.version,
		});

		const editStart = Date.now();

		await editor.edit((builder) => {
			builder.insert(new Position(0, 0), editMarker);
		});
		ciLog(`waitForDiagnosticsWithRetry: edit applied`, {
			attempt,
			durationMs: Date.now() - editStart,
			newVersion: editor.document.version,
		});

		const saveStart = Date.now();

		await editor.document.save();
		ciLog(`waitForDiagnosticsWithRetry: document saved`, {
			attempt,
			durationMs: Date.now() - saveStart,
		});

		try {
			const waitStart = Date.now();
			const diagnostics = await waitForDiagnostics(editor, { timeout: attemptTimeoutMs });

			ciLog(`waitForDiagnosticsWithRetry: SUCCESS on attempt ${attempt}`, {
				count: diagnostics.length,
				waitDurationMs: Date.now() - waitStart,
				totalDurationMs: Date.now() - phaseStart,
				diagnostics: diagnostics.map((d) => ({
					code: typeof d.code === 'object' && d.code !== null ? d.code.value : d.code,
					msg: d.message.slice(0, 100),
				})),
			});

			return diagnostics;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			ciLog(`waitForDiagnosticsWithRetry: attempt ${attempt} FAILED`, {
				error: lastError.message,
				currentDiagnostics: getStylelintDiagnostics(editor.document.uri).map((d) => ({
					source: d.source,
					code: typeof d.code === 'object' && d.code !== null ? d.code.value : d.code,
					msg: d.message.slice(0, 100),
				})),
				stateFile: ciReadStateFileSync(),
			});

			if (attempt < maxAttempts) {
				// Brief pause before retrying to let server stabilize.
				await sleep(500, signal);
			}
		}
	}

	ciLog('waitForDiagnosticsWithRetry: ALL ATTEMPTS EXHAUSTED', {
		maxAttempts,
		totalDurationMs: Date.now() - phaseStart,
		lastError: lastError?.message,
	});
	ciDumpState('waitForDiagnosticsWithRetry-exhausted');
	throw lastError ?? new Error('Failed to get diagnostics after retries');
}

describe('Worker crash recovery', function workerCrashRecovery() {
	this.timeout(120000);

	restoreFile(targetFile);
	restoreFile('worker-crash/stylelint.config.js');

	let abortController: AbortController;

	beforeEach(async () => {
		suiteStartMs = Date.now();
		abortController = new AbortController();

		ciLog('=== SETUP START ===', {
			platform: process.platform,
			arch: process.arch,
			pid: process.pid,
			nodeVersion: process.version,
			cwd: process.cwd(),
			workspaceFolders: workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [],
			crashStatePath: getCrashStatePath(),
			env: {
				CI: process.env.CI,
				GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
				RUNNER_OS: process.env.RUNNER_OS,
			},
		});

		await resetCrashState();
		ciStartHeartbeat(5000);
		ciLog('=== SETUP DONE ===');
	});

	afterEach(async function afterEachHook() {
		ciStopHeartbeat();

		// Dump final state, especially valuable when the test timed out.
		ciDumpState(`afterEach (test status: ${this.currentTest?.state ?? 'unknown'})`);

		abortController.abort();
		await closeAllEditors();
		await resetCrashState();
		ciLog('=== TEARDOWN DONE ===');
	});

	it('restores diagnostics after restarting the server', async () => {
		const { signal } = abortController;

		// Phase 1: Trigger crash attempts
		ciLog('>>> Phase 1: triggerCrashAttempts(3)');
		const phase1Start = Date.now();

		await triggerCrashAttempts(3, signal);
		ciLog('<<< Phase 1 complete', { durationMs: Date.now() - phase1Start });

		// Phase 2: Confirm crash attempts recorded
		ciLog('>>> Phase 2: waitForCrashAttempts(3)');
		const phase2Start = Date.now();

		await waitForCrashAttempts(3, 10000, signal);
		ciLog('<<< Phase 2 complete', { durationMs: Date.now() - phase2Start });

		// Phase 3: Open and close target to ensure server knows about it
		ciLog('>>> Phase 3: open/close target file');
		const phase3Start = Date.now();

		await openDocument(targetFile);
		ciLog('Phase 3: target opened', {
			uri: window.activeTextEditor?.document.uri.toString(),
			diagnostics: getStylelintDiagnostics(window.activeTextEditor!.document.uri).length,
		});
		await closeAllEditors();
		ciLog('<<< Phase 3 complete', { durationMs: Date.now() - phase3Start });

		// Phase 4: Restart the Stylelint language server
		ciLog('>>> Phase 4: stylelint.restart command');
		const phase4Start = Date.now();

		try {
			await commands.executeCommand('stylelint.restart');
			ciLog('Phase 4: restart command completed normally', {
				durationMs: Date.now() - phase4Start,
			});
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);

			ciLog('Phase 4: restart command threw', {
				error: msg,
				durationMs: Date.now() - phase4Start,
			});

			if (!(error instanceof Error) || !error.message.includes('connection got disposed')) {
				throw error;
			}
		}

		ciLog('<<< Phase 4 complete', { durationMs: Date.now() - phase4Start });

		// Phase 5: Trigger config change to nudge the server
		ciLog('>>> Phase 5: triggerConfigChange');
		const phase5Start = Date.now();

		await triggerConfigChange();
		ciLog('<<< Phase 5 complete', { durationMs: Date.now() - phase5Start });

		// Phase 6: Reopen target file and wait for diagnostics
		ciLog('>>> Phase 6: reopen target and waitForDiagnosticsWithRetry');
		const phase6Start = Date.now();

		const reopened = await openDocument(targetFile);

		ciLog('Phase 6: target reopened', {
			uri: reopened.document.uri.toString(),
			documentVersion: reopened.document.version,
			existingDiagnostics: getStylelintDiagnostics(reopened.document.uri).length,
			openDurationMs: Date.now() - phase6Start,
		});

		const diagnostics = await waitForDiagnosticsWithRetry(reopened, 5, 10000, signal);

		ciLog('<<< Phase 6 complete', {
			diagnosticCount: diagnostics.length,
			durationMs: Date.now() - phase6Start,
		});

		// Phase 7: Assertions
		ciLog('>>> Phase 7: assertions');
		const diagnostic = diagnostics[0];

		ciLog('Phase 7: first diagnostic', {
			code: diagnostic
				? typeof diagnostic.code === 'object' && diagnostic.code !== null
					? diagnostic.code.value
					: diagnostic.code
				: '<none>',
			message: diagnostic?.message?.slice(0, 200),
			source: diagnostic?.source,
		});

		assert.ok(diagnostic, 'Expected Stylelint diagnostic after worker recovery');
		assert.equal(diagnostic.code, 'stylelint-crash/force-worker-crash');
		assert.ok(
			diagnostic.message.includes('(stylelint-crash/force-worker-crash)'),
			'Expected recovery message to include rule reference',
		);
		const recoveryMatch = /Worker recovered after (\d+) attempts/.exec(diagnostic.message);

		assert.ok(recoveryMatch, 'Expected recovery message to include attempt count');
		const recoveryAttempts = Number.parseInt(recoveryMatch[1], 10);

		ciLog('Phase 7: recovery attempts', { recoveryAttempts });
		assert.ok(
			recoveryAttempts >= 4,
			`Expected worker recovery to take at least 4 attempts (received ${recoveryAttempts})`,
		);

		ciLog('<<< Phase 7 complete, TEST PASSED', {
			totalDurationMs: Date.now() - suiteStartMs,
		});
	});
});
