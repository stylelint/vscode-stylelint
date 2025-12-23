import fs from 'node:fs/promises';
import path from 'node:path';
import { Position, Range } from 'vscode';

import {
	openDocument,
	waitForDiagnostics,
	assertDiagnostics,
	closeAllEditors,
	getStylelintDiagnostics,
	waitFor,
} from '../helpers.js';

describe('Stylelint resolution', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should resolve Stylelint using local node_modules', async () => {
		const document = await openDocument('defaults/local-stylelint/test.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'fake',
				message: 'Fake result from resolve-local',
				range: [0, 0, 0, 1],
				severity: 'error',
			},
		]);
	});

	describe('when using "stylelint.stylelintPath"', () => {
		it('should resolve Stylelint', async () => {
			const document = await openDocument('stylelint-path/test.css');
			const diagnostics = await waitForDiagnostics(document);

			assertDiagnostics(diagnostics, [
				{
					code: 'fake',
					message: 'Fake result',
					range: [0, 0, 0, 1],
					severity: 'error',
				},
			]);
		});

		it('refreshes when Stylelint implementation changes', async () => {
			const editor = await openDocument('stylelint-path/test.css');
			const initialDiagnostics = await waitForDiagnostics(editor);

			assertDiagnostics(initialDiagnostics, [
				{
					code: 'fake',
					message: 'Fake result',
					range: [0, 0, 0, 1],
					severity: 'error',
				},
			]);

			const stylelintPath = path.resolve(
				__dirname,
				'..',
				'workspace',
				'stylelint-path',
				'fake-stylelint.js',
			);
			const originalSource = await fs.readFile(stylelintPath, 'utf8');
			const updatedSource = originalSource.replace('Fake result', 'Fake result updated');

			await fs.writeFile(stylelintPath, updatedSource, 'utf8');

			try {
				// Nudge the document to trigger revalidation without changing its final contents.
				await editor.edit((editBuilder) => editBuilder.insert(new Position(0, 0), ' '));
				await editor.edit((editBuilder) => editBuilder.delete(new Range(0, 0, 0, 1)));

				const refreshedDiagnostics = await waitFor(
					() => getStylelintDiagnostics(editor.document.uri),
					(diagnostics) => diagnostics.some((diag) => diag.message === 'Fake result updated'),
					{ timeout: 15000 },
				);

				assertDiagnostics(refreshedDiagnostics, [
					{
						code: 'fake',
						message: 'Fake result updated',
						range: [0, 0, 0, 1],
						severity: 'error',
					},
				]);
			} finally {
				await fs.writeFile(stylelintPath, originalSource, 'utf8');
				await editor.edit((editBuilder) => editBuilder.insert(new Position(0, 0), ' '));
				await editor.edit((editBuilder) => editBuilder.delete(new Range(0, 0, 0, 1)));
				await waitFor(
					() => getStylelintDiagnostics(editor.document.uri),
					(diagnostics) => diagnostics.some((diag) => diag.message === 'Fake result'),
					{ timeout: 15000 },
				);
			}
		});
	});

	describe('when ESM Stylelint is available', () => {
		it('should resolve Stylelint using ESM module', async () => {
			const document = await openDocument('prefer-esm/test.css');
			const diagnostics = await waitForDiagnostics(document);

			assertDiagnostics(diagnostics, [
				{
					code: 'fake',
					message: 'Fake result from ESM',
					range: [0, 0, 0, 1],
					severity: 'error',
				},
			]);
		});
	});

	describe('Stylelint resolution using PnP', () => {
		afterEach(async () => {
			await closeAllEditors();
		});

		it('should resolve Stylelint using PnP', async () => {
			const document = await openDocument('defaults/yarn-pnp/test.css');
			const diagnostics = await waitForDiagnostics(document);

			assertDiagnostics(diagnostics, [
				{
					code: 'fake',
					message: 'Fake result from yarn-pnp',
					range: [0, 0, 0, 1],
					severity: 'error',
				},
			]);
		});

		it('should resolve Stylelint using Yarn PnP with ESM', async () => {
			const document = await openDocument('defaults/yarn-pnp-esm/test.css');
			const diagnostics = await waitForDiagnostics(document);

			assertDiagnostics(diagnostics, [
				{
					code: 'fake',
					message: 'Fake result from yarn-pnp-esm',
					range: [0, 0, 0, 1],
					severity: 'error',
				},
			]);
		});
	});
});
