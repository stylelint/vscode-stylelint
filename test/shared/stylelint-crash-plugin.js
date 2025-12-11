// @ts-nocheck
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { cwd: getCwd, exit } = require('node:process');
const stylelint = require('stylelint').default ?? require('stylelint');

const ruleName = 'stylelint-crash/force-worker-crash';
const defaultStateFilename = '.stylelint-worker-crash-state.json';

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
		const attempt = readAttempts(statePath) + 1;

		writeAttempts(statePath, attempt);

		if (attempt <= maxCrashes) {
			exit(1);
		}

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
rule.resetState = (baseCwd = getCwd(), stateFile) => {
	const target = rule.getStatePath(baseCwd, stateFile);

	try {
		fs.rmSync(target, { force: true });
	} catch {
		// ignore
	}
};

module.exports = rule;
