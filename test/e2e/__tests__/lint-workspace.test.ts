import path from 'node:path';
import { commands, workspace, Uri } from 'vscode';
import {
	assertDiagnostics,
	closeAllEditors,
	getStylelintDiagnostics,
	waitFor,
} from '../helpers.js';

describe('Lint Commands', () => {
	afterEach(async () => {
		await commands.executeCommand('stylelint.clearAllProblems');
		await closeAllEditors();
	});

	it('should lint a specific workspace folder via lintWorkspaceFolder command', async () => {
		const defaultsFolder = workspace.workspaceFolders?.find(({ name }) => name === 'defaults');

		if (!defaultsFolder) {
			throw new Error('Defaults workspace folder not found');
		}

		await commands.executeCommand('stylelint.lintWorkspaceFolder', defaultsFolder);

		const lintCssUri = Uri.file(path.join(defaultsFolder.uri.fsPath, 'lint.css'));

		const diagnostics = await waitFor(
			() => getStylelintDiagnostics(lintCssUri),
			(result) => result.length > 0,
			{ timeout: 30000 },
		);

		assertDiagnostics(diagnostics, [
			{
				code: 'color-hex-length',
				message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
				range: [2, 9, 2, 13],
				severity: 'error',
			},
		]);
	});

	it('should lint all files via lintAllFiles command', async () => {
		const defaultsFolder = workspace.workspaceFolders?.find(({ name }) => name === 'defaults');

		if (!defaultsFolder) {
			throw new Error('Defaults workspace folder not found');
		}

		await commands.executeCommand('stylelint.lintAllFiles');

		const lintCssUri = Uri.file(path.join(defaultsFolder.uri.fsPath, 'lint.css'));

		const diagnostics = await waitFor(
			() => getStylelintDiagnostics(lintCssUri),
			(result) => result.length > 0,
			{ timeout: 30000 },
		);

		assertDiagnostics(diagnostics, [
			{
				code: 'color-hex-length',
				message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
				range: [2, 9, 2, 13],
				severity: 'error',
			},
		]);
	});

	it('should clear all problems via clearAllProblems command', async () => {
		const defaultsFolder = workspace.workspaceFolders?.find(({ name }) => name === 'defaults');

		if (!defaultsFolder) {
			throw new Error('Defaults workspace folder not found');
		}

		await commands.executeCommand('stylelint.lintWorkspaceFolder', defaultsFolder);

		const lintCssUri = Uri.file(path.join(defaultsFolder.uri.fsPath, 'lint.css'));

		await waitFor(
			() => getStylelintDiagnostics(lintCssUri),
			(result) => result.length > 0,
			{ timeout: 30000 },
		);

		await commands.executeCommand('stylelint.clearAllProblems');

		const cleared = await waitFor(
			() => getStylelintDiagnostics(lintCssUri),
			(result) => result.length === 0,
			{ timeout: 10000 },
		);

		assertDiagnostics(cleared, []);
	});
});
