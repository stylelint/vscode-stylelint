import { TextDocument } from 'vscode-languageserver-textdocument';
import type stylelint from 'stylelint';
import type { StylelintRunner } from '../../stylelint';
import type { RunnerOptions } from '../../stylelint';

import { getFixes } from '../get-fixes';

const createMockRunner = (output?: string) =>
	({
		lintDocument: jest.fn(async () => ({ diagnostics: [], output })),
	} as unknown as StylelintRunner);

const createDocument = (code: string) =>
	TextDocument.create('file:///path/test.css', 'css', 1, code);

describe('getFixes', () => {
	test('should call lintDocument with given options and fix set to true', async () => {
		const document = createDocument('a { color: red; }');
		const runner = createMockRunner('a { color: red; }');
		const linterOptions: stylelint.LinterOptions = {
			config: {
				customSyntax: 'postcss-scss',
			},
			fix: false,
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
		const runner = createMockRunner();
		const fixes = await getFixes(runner, document);

		expect(fixes).toEqual([]);
	});

	test('should return no edits if Stylelint made no changes', async () => {
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
		const runner = createMockRunner(`
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
		const runner = createMockRunner(`
			a {
			  color: red;
			}

			.foo {
			  overflow: hidden;
			  background: #ccc url(foo.png) no-repeat;
			}
		`);
		const fixes = await getFixes(runner, document);

		expect(fixes).toMatchSnapshot();
	});
});
