/* eslint-disable require-jsdoc */
import * as assert from 'node:assert/strict';

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
	code: string;
	codeDescription?: string;
	message: string;
	range: ExpectedRange;
	severity: 'error' | 'warning';
};

function assertRange(actual: Range, expected: ExpectedRange) {
	const { start, end } = actual;

	assert.deepEqual([start.line, start.character, end.line, end.character], expected);
}

export function assertDiagnostic(
	diagnostic: Diagnostic | undefined,
	expected: ExpectedDiagnostic | undefined,
) {
	assert.ok(diagnostic);
	assert.ok(expected);

	const { code, codeDescription = '', message, range, severity } = expected;

	assert.equal(diagnostic.source, 'Stylelint');

	if (typeof diagnostic.code === 'string') {
		assert.equal(diagnostic.code, code);
	} else if (typeof diagnostic.code === 'object') {
		assert.equal(diagnostic.code.value, code);
		assert.equal(diagnostic.code.target.toString(), codeDescription);
	} else {
		assert.fail(`"code" is not a string or object: ${diagnostic.code}`);
	}

	assert.equal(diagnostic.message, message);
	assertRange(diagnostic.range, range);
	assert.equal(
		diagnostic.severity,
		severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
	);
}

export function assertDiagnostics(diagnostics: Diagnostic[], expected: ExpectedDiagnostic[]) {
	assert.equal(diagnostics.length, expected.length);

	for (let i = 0; i < expected.length; i++) {
		assertDiagnostic(diagnostics[i], expected[i]);
	}
}

type ExpectedTextEdit = {
	newText: string;
	range: ExpectedRange;
};

export function assertTextEdits(actual: TextEdit[] | undefined, expected: ExpectedTextEdit[]) {
	assert.ok(actual);
	assert.equal(actual.length, expected.length);

	for (let i = 0; i < expected.length; i++) {
		assert.equal(actual[i].newText, expected[i].newText);
		assertRange(actual[i].range, expected[i].range);
	}
}

type ExpectedCommand = {
	title: string;
	command: string;
	tooltip?: string;
	arguments?: unknown[];
};

export function assertCommand(actual: Command | undefined, expected: ExpectedCommand) {
	assert.ok(actual);
	assert.equal(actual.title, expected.title);
	assert.equal(actual.command, expected.command);
	assert.equal(actual.tooltip, expected.tooltip);
	assert.deepEqual(actual.arguments, expected.arguments);
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
