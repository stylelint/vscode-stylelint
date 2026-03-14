import path from 'node:path';
import { tasks, workspace, Uri } from 'vscode';
import {
	assertDiagnostics,
	closeAllEditors,
	getStylelintDiagnostics,
	matchVersion,
	waitFor,
	type ExpectedDiagnostic,
} from '../helpers.js';

/**
 * Execute a workspace task by label and resolve when it is finished.
 */
async function runTask(label: string): Promise<void> {
	const allTasks = await tasks.fetchTasks();
	const task = allTasks.find((t) => t.name === label);

	if (!task) {
		const available = allTasks.map((t) => t.name).join(', ');

		throw new Error(`Task "${label}" not found. Available: ${available}`);
	}

	return new Promise((resolve, reject) => {
		const disposable = tasks.onDidEndTaskProcess((e) => {
			if (e.execution.task.name === label) {
				disposable.dispose();
				resolve();
			}
		});

		tasks.executeTask(task).then(undefined, (err: unknown) => {
			disposable.dispose();
			reject(err instanceof Error ? err : new Error(String(err)));
		});
	});
}

const expectedDiagnostics: ExpectedDiagnostic[] = [
	{
		code: 'color-hex-length',
		message: 'Expected "#fff" to be "#ffffff"',
		range: [4, 9, 4, 9],
		severity: 'error',
	},
	{
		code: 'value-keyword-case',
		message: 'Expected "BLOCK" to be "block"',
		range: [9, 11, 9, 11],
		severity: 'error',
	},
	{
		code: 'color-no-invalid-hex',
		message: 'Unexpected invalid hex color "#abcxyz"', // cspell:disable-line
		range: [14, 9, 14, 9],
		severity: 'error',
	},
	{
		code: 'font-family-no-duplicate-names',
		message: matchVersion({
			'<16': 'Unexpected duplicate name serif',
			default: 'Unexpected duplicate font-family name serif',
		}),
		range: [19, 22, 19, 22],
		severity: 'error',
	},
	{
		code: 'declaration-block-no-duplicate-properties',
		message: 'Unexpected duplicate "color"',
		range: matchVersion({
			'<16': [25, 2, 25, 2],
			default: [24, 2, 24, 2],
		}),
		severity: 'error',
	},
	{
		code: 'block-no-empty',
		message: 'Unexpected empty block',
		range: [29, 2, 29, 2],
		severity: 'error',
	},
	{
		code: 'number-max-precision',
		message: 'Expected "10.123" to be "10.12"',
		range: [33, 9, 33, 9],
		severity: 'error',
	},
	{
		code: 'selector-pseudo-class-no-unknown',
		message: 'Unexpected unknown pseudo-class selector ":hoverr"', // cspell:disable-line
		range: [37, 1, 37, 1],
		severity: 'error',
	},
	{
		code: 'selector-pseudo-element-colon-notation',
		message: 'Expected double colon pseudo-element notation',
		range: [42, 1, 42, 1],
		severity: 'error',
	},
	{
		code: 'selector-type-case',
		message: 'Expected "A" to be "a"',
		range: [47, 0, 47, 0],
		severity: 'error',
	},
	{
		code: 'shorthand-property-no-redundant-values',
		message: 'Expected "1px 1px 1px 1px" to be "1px"',
		range: matchVersion({
			'<16': [53, 2, 53, 2],
			default: [53, 10, 53, 10],
		}),
		severity: 'error',
	},
	{
		code: 'declaration-block-single-line-max-declarations',
		message: 'Expected no more than 1 declaration',
		range: [57, 2, 57, 2],
		severity: 'error',
	},
	{
		code: 'no-duplicate-selectors',
		message: 'Unexpected duplicate selector ".dup", first used at line 61',
		range: [61, 0, 61, 0],
		severity: 'error',
	},
	{
		code: 'comment-no-empty',
		message: 'Unexpected empty comment',
		range: [64, 0, 64, 0],
		severity: 'error',
	},
	{
		code: 'font-family-name-quotes',
		message: 'Expected quotes around "Times New Roman"',
		range: [68, 15, 68, 15],
		severity: 'error',
	},
	{
		code: 'declaration-no-important',
		message: 'Unexpected !important',
		range: [73, 13, 73, 13],
		severity: 'error',
	},
	{
		code: 'unit-no-unknown',
		message: 'Unexpected unknown unit "pxx"',
		range: [78, 12, 78, 12],
		severity: 'error',
	},
	{
		code: 'property-no-unknown',
		message: 'Unexpected unknown property "colr"', // cspell:disable-line
		range: [83, 2, 83, 2],
		severity: 'error',
	},
	{
		code: 'max-nesting-depth',
		message: 'Expected nesting depth to be no more than 2',
		range: [90, 6, 90, 6],
		severity: 'error',
	},
	{
		code: 'selector-max-id',
		message: 'Expected "#myid" to have no more than 0 ID selectors', // cspell:disable-line
		range: [98, 0, 98, 0],
		severity: 'error',
	},
];

describe('Problem Matchers', () => {
	const lintTaskFolder = workspace.workspaceFolders?.find(({ name }) => name === 'lint-task');

	afterEach(async () => {
		await closeAllEditors();
	});

	it('should parse compact formatter output into diagnostics', async () => {
		if (!lintTaskFolder) {
			throw new Error('lint-task workspace folder not found');
		}

		const testCssUri = Uri.file(path.join(lintTaskFolder.uri.fsPath, 'test.css'));

		await runTask('stylelint-compact');

		const diagnostics = await waitFor(
			() => getStylelintDiagnostics(testCssUri),
			(result) => result.length >= expectedDiagnostics.length,
			{ timeout: 15000 },
		);

		assertDiagnostics(diagnostics, expectedDiagnostics);
	});

	it('should parse unix formatter output into diagnostics', async () => {
		if (!lintTaskFolder) {
			throw new Error('lint-task workspace folder not found');
		}

		const testCssUri = Uri.file(path.join(lintTaskFolder.uri.fsPath, 'test.css'));

		await runTask('stylelint-unix');

		const diagnostics = await waitFor(
			() => getStylelintDiagnostics(testCssUri),
			(result) => result.length >= expectedDiagnostics.length,
			{ timeout: 15000 },
		);

		assertDiagnostics(diagnostics, expectedDiagnostics);
	});
});
