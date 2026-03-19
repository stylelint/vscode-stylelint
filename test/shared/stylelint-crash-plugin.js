// @ts-nocheck
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { cwd: getCwd, env: nodeEnv, exit, pid } = require('node:process');
const stylelint = require('stylelint').default ?? require('stylelint');

const ruleName = 'stylelint-crash/force-worker-crash';
const defaultStateFilename = '.stylelint-worker-crash-state.json';
const IS_CI = Boolean(nodeEnv.CI);
const diagLogFilename = '.stylelint-worker-crash-diag.log';

/**
 * Appends a timestamped diagnostic line to the plugin's diagnostic log file.
 * Only writes when the CI environment variable is set.
 */
function diagLog(basePath, message) {
	if (!IS_CI) return;

	try {
		const logPath = path.join(basePath, diagLogFilename);
		const line = `[${new Date().toISOString()}] [PID:${pid}] ${message}\n`;

		fs.appendFileSync(logPath, line);
	} catch {
		// Silently ignore, diagnostics must never break the plugin.
	}
}

const messages = stylelint.utils.ruleMessages(ruleName, {
	recovered(attempts) {
		return `Worker recovered after ${attempts} attempts`;
	},
});

/**
 * Resolves the path to the crash state file.
 */
function resolveStatePath(stateFile) {
	if (!stateFile) {
		return path.join(getCwd(), defaultStateFilename);
	}

	return path.isAbsolute(stateFile) ? stateFile : path.resolve(getCwd(), stateFile);
}

/**
 * Reads the number of recorded crash attempts.
 */
function readAttempts(statePath) {
	try {
		const raw = fs.readFileSync(statePath, 'utf8');
		const parsed = JSON.parse(raw);

		return typeof parsed.attempts === 'number' ? parsed.attempts : 0;
	} catch (error) {
		if (error && (error.code === 'ENOENT' || error.code === 'EISDIR')) {
			return 0;
		}

		return 0;
	}
}

/**
 * Writes the number of recorded crash attempts.
 */
function writeAttempts(statePath, attempts) {
	try {
		fs.writeFileSync(statePath, JSON.stringify({ attempts }));
	} catch {
		// ignore write failures in CI noise
	}
}

const rule = stylelint.createPlugin(ruleName, (primaryOption) => {
	const optionValue =
		typeof primaryOption === 'object' && primaryOption !== null ? primaryOption : {};
	const resolvedMaxFromOption =
		typeof optionValue.maxCrashes === 'number' && Number.isFinite(optionValue.maxCrashes)
			? optionValue.maxCrashes
			: undefined;
	const maxCrashes =
		resolvedMaxFromOption !== undefined
			? resolvedMaxFromOption
			: typeof primaryOption === 'number'
				? primaryOption
				: 3;
	const statePath = resolveStatePath(optionValue.stateFile);

	return (root, result) => {
		const stateDir = path.dirname(statePath);

		diagLog(
			stateDir,
			`Plugin executing. statePath=${statePath}, maxCrashes=${maxCrashes}, cwd=${getCwd()}`,
		);

		const previousAttempts = readAttempts(statePath);
		const attempt = previousAttempts + 1;

		diagLog(stateDir, `Read previous attempts: ${previousAttempts}, incrementing to ${attempt}`);

		writeAttempts(statePath, attempt);

		// Verify the write landed.
		const verified = readAttempts(statePath);

		diagLog(stateDir, `Write verified: expected=${attempt}, actual=${verified}`);

		if (attempt <= maxCrashes) {
			diagLog(
				stateDir,
				`CRASHING: attempt ${attempt} <= maxCrashes ${maxCrashes}, calling process.exit(1)`,
			);
			exit(1);
		}

		diagLog(
			stateDir,
			`RECOVERED: attempt ${attempt} > maxCrashes ${maxCrashes}, reporting diagnostic`,
		);

		stylelint.utils.report({
			message: messages.recovered(attempt),
			node: root,
			result,
			ruleName,
		});
	};
});

rule.ruleName = ruleName;
rule.messages = messages;
rule.defaultStateFilename = defaultStateFilename;
rule.getStatePath = (baseCwd = getCwd(), stateFile) =>
	stateFile
		? path.isAbsolute(stateFile)
			? stateFile
			: path.join(baseCwd, stateFile)
		: path.join(baseCwd, defaultStateFilename);
rule.diagLogFilename = diagLogFilename;
rule.resetState = (baseCwd = getCwd(), stateFile) => {
	const target = rule.getStatePath(baseCwd, stateFile);

	try {
		fs.rmSync(target, { force: true });
	} catch {
		// ignore
	}

	// Also clean up the CI diagnostic log.
	try {
		fs.rmSync(path.join(path.dirname(target), diagLogFilename), { force: true });
	} catch {
		// ignore
	}
};

module.exports = rule;
