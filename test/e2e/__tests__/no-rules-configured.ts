import * as assert from 'node:assert/strict';

import {
	openDocument,
	waitForDiagnostics,
	assertDiagnostics,
	executeAutofix,
	closeAllEditors,
} from '../helpers';

describe('No rules configured', () => {
	afterEach(async () => {
		await closeAllEditors();
	});

	it('should show configuration error when no rules are defined', async () => {
		const { document } = await openDocument('no-rules-configured/test.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'no-rules-configured',
				message: 'No rules found within configuration. Have you provided a "rules" property?',
				range: [0, 0, 0, 0],
				severity: 'error',
			},
		]);
	});

	it('should show both syntax errors and configuration error when no rules are defined', async () => {
		const { document } = await openDocument('no-rules-configured/test-syntax-error.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'CssSyntaxError',
				message: 'Unclosed block (CssSyntaxError)',
				range: [1, 0, 1, 1],
				severity: 'error',
			},
			{
				code: 'no-rules-configured',
				message: 'No rules found within configuration. Have you provided a "rules" property?',
				range: [0, 0, 0, 0],
				severity: 'error',
			},
		]);
	});

	it('should auto-fix syntax errors when no rules are defined', async () => {
		const { document } = await openDocument('no-rules-configured/test-syntax-error.css');
		const diagnostics = await waitForDiagnostics(document);

		assertDiagnostics(diagnostics, [
			{
				code: 'CssSyntaxError',
				message: 'Unclosed block (CssSyntaxError)',
				range: [1, 0, 1, 1],
				severity: 'error',
			},
			{
				code: 'no-rules-configured',
				message: 'No rules found within configuration. Have you provided a "rules" property?',
				range: [0, 0, 0, 0],
				severity: 'error',
			},
		]);

		await executeAutofix();

		const fixedContent = document.getText();

		assert.ok(fixedContent.includes('}'), 'Auto-fix should add the missing closing brace');

		const postFixDiagnostics = await waitForDiagnostics(document);
		const hasConfigError = postFixDiagnostics.some((d) => d.code === 'no-rules-configured');

		assert.ok(hasConfigError, 'Configuration error should still be present after autofix');
	});
});
