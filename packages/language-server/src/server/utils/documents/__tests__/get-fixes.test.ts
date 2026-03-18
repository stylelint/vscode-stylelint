import { TextDocument } from 'vscode-languageserver-textdocument';
import type stylelint from 'stylelint';
import type { RunnerOptions } from '../../../stylelint/index.js';
import { vi, describe, test, expect } from 'vitest';

import { getFixes } from '../get-fixes.js';
import { StylelintRunnerService } from '../../../services/index.js';

const createMockRunner = (result: { code?: string; output?: string } = {}) =>
	({
		lintDocument: vi.fn(async () => ({ diagnostics: [], ...result })),
	}) as unknown as StylelintRunnerService;

const createDocument = (code: string) =>
	TextDocument.create('file:///path/test.css', 'css', 1, code);

describe('getFixes', () => {
	test('should call lintDocument with given options and fix set to true', async () => {
		const document = createDocument('a { color: red; }');
		const runner = createMockRunner({ code: 'a { color: red; }' });
		const linterOptions: stylelint.LinterOptions = {
			config: {
				customSyntax: 'postcss-scss',
			},
			fix: false,
			reportDescriptionlessDisables: false,
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: false,
		};

		const runnerOptions: RunnerOptions = {
			packageManager: 'pnpm',
			validate: ['css', 'less', 'sass', 'scss'],
		};

		await getFixes(runner, document, linterOptions, runnerOptions);

		expect(runner.lintDocument).toHaveBeenCalledWith(
			document,
			expect.objectContaining({
				...linterOptions,
				fix: true,
			}),
			runnerOptions,
		);
	});

	test('should return no edits if Stylelint returned no output', async () => {
		const document = createDocument(`
			a {
				color: red;
			}

			div#foo {
			}

			.foo {
				overflow: hidden;
				background: #ccc url(foo.png) no-repeat;
			}
		`);
		const runner = createMockRunner({ code: document.getText() });
		const fixes = await getFixes(runner, document);

		expect(fixes).toEqual([]);
	});

	test('should return no edits if Stylelint made no changes', async () => {
		const document = createDocument(`
			a {
				color: red;
			}

			div#bar {
			}

			.foo {
				overflow: hidden;
				background: #ccc url(foo.png) no-repeat;
			}
		`);
		const runner = createMockRunner({
			code: document.getText(),
		});
		const fixes = await getFixes(runner, document);

		expect(fixes).toEqual([]);
	});

	test('should return edits if Stylelint made changes', async () => {
		const document = createDocument(`
			a {
				color: red;
			}

			div#bar {
			}

			.foo {
				overflow: hidden;
				background: #ccc url(foo.png) no-repeat;
			}
		`);
		const runner = createMockRunner({
			code: document.getText().replace(/\t\t\tdiv#bar \{\n\t\t\t\}\n\n/, ''),
		});
		const fixes = await getFixes(runner, document);

		expect(fixes).toMatchSnapshot();
	});

	test('should fall back to legacy output when code is unavailable', async () => {
		const document = createDocument('a { color: red; }');
		const runner = createMockRunner({ output: 'a { color: red }' });
		const fixes = await getFixes(runner, document);

		expect(fixes).toMatchSnapshot();
	});

	test('should ignore empty legacy output', async () => {
		const document = createDocument('a { color: red; }');
		const runner = createMockRunner({ output: '' });
		const fixes = await getFixes(runner, document);

		expect(fixes).toEqual([]);
	});
});
