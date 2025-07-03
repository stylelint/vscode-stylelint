/* eslint-disable jsdoc/require-jsdoc */
import * as assert from 'node:assert/strict';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
	commands,
	languages,
	window,
	workspace,
	ConfigurationTarget,
	DiagnosticSeverity,
	Range,
	RelativePattern,
	type CodeAction,
	type Command,
	type Diagnostic,
	type Selection,
	type TextDocument,
	type TextEdit,
	type TextEditor,
	type Uri,
} from 'vscode';

export function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getWorkspaceFile(filePath: string): Promise<Uri> {
	const separatorPosition = filePath.indexOf('/');
	const workspaceName = filePath.slice(0, separatorPosition);
	const fileName = filePath.slice(separatorPosition + 1);
	const workspaceFolder = workspace.workspaceFolders?.find(({ name }) => name === workspaceName);

	assert.ok(workspaceFolder, `A workspace for "${filePath}" is not found`);

	const files = await workspace.findFiles(new RelativePattern(workspaceFolder, fileName));

	assert.equal(
		files.length,
		1,
		`The number of the "${fileName}" files in the "${workspaceName}" workspace must be 1`,
	);

	return files[0];
}

export async function openDocument(filePath: string) {
	const file = await getWorkspaceFile(filePath);
	const document = await workspace.openTextDocument(file);

	return window.showTextDocument(document);
}

export async function closeAllEditors() {
	await commands.executeCommand('workbench.action.closeAllEditors');
}

export function getStylelintDiagnostics(uri: Uri) {
	return languages.getDiagnostics(uri).filter((d) => d.source === 'Stylelint');
}

type WaitForOptions = {
	timeout?: number;
	interval?: number;
};

export async function waitFor<T>(
	produce: () => T,
	condition: (result: T) => boolean,
	{ timeout = 10000, interval = 20 }: WaitForOptions = {},
): Promise<T> {
	let intervalRef: NodeJS.Timer;
	let timeoutRef: NodeJS.Timeout;

	return new Promise((resolve, reject) => {
		intervalRef = setInterval(() => {
			const result = produce();

			if (condition(result)) {
				clearInterval(intervalRef);
				clearTimeout(timeoutRef);
				resolve(result);
			}
		}, interval);

		timeoutRef = setTimeout(() => {
			clearInterval(intervalRef);
			clearTimeout(timeoutRef);
			reject(new Error(`Timed out in "waitFor" (timeout=${timeout}, interval=${interval})`));
		}, timeout);
	});
}

export function waitForDiagnostics(
	editorOrDocument: TextEditor | TextDocument,
	options?: WaitForOptions,
): Promise<Diagnostic[]> {
	const uri = 'document' in editorOrDocument ? editorOrDocument.document.uri : editorOrDocument.uri;

	return waitFor(
		() => getStylelintDiagnostics(uri),
		(diagnostics) => diagnostics.length > 0,
		options,
	);
}

type ExpectedRange = [number, number, number, number];

type ExpectedDiagnostic = {
	code: number | string;
	codeDescription?: string;
	message: string;
	range: ExpectedRange;
	severity: 'error' | 'warning' | 'info' | 'hint';
};

type ExpectedTextEdit = {
	newText: string;
	range: ExpectedRange;
};

type ExpectedCommand = {
	title: string;
	command: string;
	tooltip?: string;
	arguments?: unknown[];
};

function normalizeRange(range: Range): ExpectedRange {
	return [range.start.line, range.start.character, range.end.line, range.end.character];
}

function normalizeSeverity(
	severity: DiagnosticSeverity | undefined,
): 'error' | 'warning' | 'info' | 'hint' {
	switch (severity) {
		case DiagnosticSeverity.Error:
			return 'error';
		case DiagnosticSeverity.Warning:
			return 'warning';
		case DiagnosticSeverity.Information:
			return 'info';
		case DiagnosticSeverity.Hint:
			return 'hint';
		case undefined:
		default:
			return 'error'; // Default fallback.
	}
}

function normalizeDiagnostic(
	diagnostic: Diagnostic,
	expected?: ExpectedDiagnostic,
): ExpectedDiagnostic {
	let code: number | string;
	let codeDescription: string | undefined;

	if (typeof diagnostic.code === 'string') {
		code = diagnostic.code;
	} else if (typeof diagnostic.code === 'object' && diagnostic.code !== null) {
		code = diagnostic.code.value;
		codeDescription = diagnostic.code.target.toString();
	} else {
		code = '';
	}

	const normalized = {
		code,
		message: diagnostic.message,
		range: normalizeRange(diagnostic.range),
		severity: normalizeSeverity(diagnostic.severity),
	};

	// Only include codeDescription if it's defined in the original diagnostic
	// and if we wish to check it against expected.
	if (codeDescription !== undefined && (!expected || 'codeDescription' in expected)) {
		return { ...normalized, codeDescription };
	}

	return normalized;
}

function normalizeTextEdit(edit: TextEdit): ExpectedTextEdit {
	return {
		newText: edit.newText,
		range: normalizeRange(edit.range),
	};
}

function normalizeCommand(command: Command): ExpectedCommand {
	const normalized: ExpectedCommand = {
		title: command.title,
		command: command.command,
	};

	if (command.tooltip !== undefined) {
		normalized.tooltip = command.tooltip;
	}

	if (command.arguments !== undefined) {
		normalized.arguments = command.arguments;
	}

	return normalized;
}

export function assertDiagnostic(
	diagnostic: Diagnostic | undefined,
	expected: ExpectedDiagnostic | undefined,
) {
	assert.ok(diagnostic, 'The diagnostic is undefined');
	assert.ok(expected, 'The expected diagnostic is undefined');
	assert.equal(diagnostic.source, 'Stylelint', 'The diagnostic source is not "Stylelint"');

	// Normalize the diagnostic with expected data and compare directly.
	assert.deepEqual(normalizeDiagnostic(diagnostic, expected), expected);
}

export function assertDiagnostics(diagnostics: Diagnostic[], expected: ExpectedDiagnostic[]) {
	// First normalize all diagnostics with expected data.
	const normalizedDiagnostics = diagnostics
		.filter((d) => d.source === 'Stylelint')
		.map((d, index) => normalizeDiagnostic(d, expected[index]));

	// Single deepEqual gives easy-to-read, rich diff output.
	assert.deepEqual(normalizedDiagnostics, expected);
}

export function assertTextEdits(actual: TextEdit[] | undefined, expected: ExpectedTextEdit[]) {
	assert.ok(actual, 'The text edits are undefined');
	assert.deepEqual(actual.map(normalizeTextEdit), expected);
}

export function assertCommand(actual: Command | undefined, expected: ExpectedCommand) {
	assert.ok(actual, 'The command is undefined');
	assert.deepEqual(normalizeCommand(actual), expected);
}

export async function executeAutofix() {
	await commands.executeCommand('stylelint.executeAutofix');
}

export function setupSettings(settings: Record<string, unknown>) {
	const configTarget = ConfigurationTarget.Workspace;

	beforeEach(async () => {
		const config = workspace.getConfiguration();

		for (const [section, value] of Object.entries(settings)) {
			await config.update(section, value, configTarget);
		}
	});

	afterEach(async () => {
		const config = workspace.getConfiguration();

		for (const section of Object.keys(settings)) {
			await config.update(section, undefined, configTarget);
		}
	});
}

export function restoreFile(filePath: string) {
	let file: Uri;
	let fileContent: Uint8Array;

	beforeEach(async () => {
		file = await getWorkspaceFile(filePath);
		fileContent = await workspace.fs.readFile(file);
	});

	afterEach(async () => {
		await workspace.fs.writeFile(file, fileContent);
	});
}

export async function getCodeActions(
	editor: TextEditor,
	selection: Selection,
): Promise<CodeAction[]> {
	editor.selection = selection;

	await sleep(1000); // HACK: Wait the UI for being shown.

	return (
		(await commands.executeCommand(
			'vscode.executeCodeActionProvider',
			editor.document.uri,
			selection,
		)) ?? []
	);
}

let stylelintMajorVersion: number | undefined;

export async function getStylelintMajorVersion(): Promise<number> {
	if (stylelintMajorVersion !== undefined) {
		return stylelintMajorVersion;
	}

	const packageJsonPath = path.join(__dirname, '../../package.json');
	const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
	const packageJson = JSON.parse(packageJsonContent);
	const stylelintVersion = packageJson.devDependencies.stylelint;

	stylelintMajorVersion = Number.parseInt(stylelintVersion.split('.')[0].replace('^', ''), 10);

	return stylelintMajorVersion;
}
