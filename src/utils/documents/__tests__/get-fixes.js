'use strict';

const { TextDocument } = require('vscode-languageserver-textdocument');

const { getFixes } = require('../get-fixes');

/**
 * @param {string} [output]
 * @returns {StylelintRunner}
 */
const createMockRunner = (output) =>
	/** @type {any} */ ({
		lintDocument: jest.fn(async () => ({ diagnostics: [], output })),
	});

/**
 * @param {string} code
 * @returns {lsp.TextDocument}
 */
const createDocument = (code) => TextDocument.create('file:///path/test.css', 'css', 1, code);

describe('getFixes', () => {
	test('should call lintDocument with given options and fix set to true', async () => {
		const document = createDocument('a { color: red; }');
		const runner = createMockRunner('a { color: red; }');
		/** @type {stylelint.LinterOptions} */
		const linterOptions = {
			config: {
				customSyntax: 'postcss-scss',
			},
			fix: false,
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: false,
		};

		/** @type {ExtensionOptions} */
		const extensionOptions = {
			packageManager: 'pnpm',
			validate: ['css', 'less', 'sass', 'scss'],
		};

		await getFixes(runner, document, linterOptions, extensionOptions);

		expect(runner.lintDocument).toHaveBeenCalledWith(
			document,
			expect.objectContaining({
				...linterOptions,
				fix: true,
			}),
			extensionOptions,
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
