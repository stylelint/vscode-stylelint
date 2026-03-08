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

	describe('Monorepo', () => {
		it('should lint files across monorepo packages with per-package configs', async () => {
			const monorepoFolder = workspace.workspaceFolders?.find(({ name }) => name === 'monorepo');

			if (!monorepoFolder) {
				throw new Error('Monorepo workspace folder not found');
			}

			await commands.executeCommand('stylelint.lintWorkspaceFolder', monorepoFolder);

			const styleAUri = Uri.file(
				path.join(monorepoFolder.uri.fsPath, 'packages', 'app-a', 'style-a.css'),
			);

			const styleADiagnostics = await waitFor(
				() => getStylelintDiagnostics(styleAUri),
				(result) => result.length > 0,
				{ timeout: 30000 },
			);

			assertDiagnostics(styleADiagnostics, [
				{
					code: 'color-hex-length',
					message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
					range: [2, 9, 2, 13],
					severity: 'error',
				},
			]);

			const styleBUri = Uri.file(
				path.join(monorepoFolder.uri.fsPath, 'packages', 'app-b', 'style-b.css'),
			);

			const styleBDiagnostics = await waitFor(
				() => getStylelintDiagnostics(styleBUri),
				(result) => result.length > 0,
				{ timeout: 30000 },
			);

			assertDiagnostics(styleBDiagnostics, [
				{
					code: 'color-named',
					message: 'Unexpected named color "red" (color-named)',
					range: [2, 9, 2, 12],
					severity: 'error',
				},
			]);
		});

		it('should respect per-package .stylelintignore files when linting workspace folder', async () => {
			const monorepoFolder = workspace.workspaceFolders?.find(({ name }) => name === 'monorepo');

			if (!monorepoFolder) {
				throw new Error('Monorepo workspace folder not found');
			}

			await commands.executeCommand('stylelint.lintWorkspaceFolder', monorepoFolder);

			const styleAUri = Uri.file(
				path.join(monorepoFolder.uri.fsPath, 'packages', 'app-a', 'style-a.css'),
			);

			await waitFor(
				() => getStylelintDiagnostics(styleAUri),
				(result) => result.length > 0,
				{ timeout: 30000 },
			);

			const ignoredAUri = Uri.file(
				path.join(monorepoFolder.uri.fsPath, 'packages', 'app-a', 'ignored-a.css'),
			);

			const ignoredADiagnostics = getStylelintDiagnostics(ignoredAUri);

			assertDiagnostics(ignoredADiagnostics, []);

			const ignoredBUri = Uri.file(
				path.join(monorepoFolder.uri.fsPath, 'packages', 'app-b', 'ignored-b.css'),
			);

			const ignoredBDiagnostics = getStylelintDiagnostics(ignoredBUri);

			assertDiagnostics(ignoredBDiagnostics, []);
		});

		it('should lint all files across monorepo packages via lintAllFiles', async () => {
			const monorepoFolder = workspace.workspaceFolders?.find(({ name }) => name === 'monorepo');

			if (!monorepoFolder) {
				throw new Error('Monorepo workspace folder not found');
			}

			await commands.executeCommand('stylelint.lintAllFiles');

			const styleAUri = Uri.file(
				path.join(monorepoFolder.uri.fsPath, 'packages', 'app-a', 'style-a.css'),
			);

			const styleADiagnostics = await waitFor(
				() => getStylelintDiagnostics(styleAUri),
				(result) => result.length > 0,
				{ timeout: 30000 },
			);

			assertDiagnostics(styleADiagnostics, [
				{
					code: 'color-hex-length',
					message: 'Expected "#fff" to be "#ffffff" (color-hex-length)',
					range: [2, 9, 2, 13],
					severity: 'error',
				},
			]);

			const styleBUri = Uri.file(
				path.join(monorepoFolder.uri.fsPath, 'packages', 'app-b', 'style-b.css'),
			);

			const styleBDiagnostics = await waitFor(
				() => getStylelintDiagnostics(styleBUri),
				(result) => result.length > 0,
				{ timeout: 30000 },
			);

			assertDiagnostics(styleBDiagnostics, [
				{
					code: 'color-named',
					message: 'Unexpected named color "red" (color-named)',
					range: [2, 9, 2, 12],
					severity: 'error',
				},
			]);
		});
	});
});
