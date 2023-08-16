import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { StylelintRunner } from '../../../src/utils/stylelint';
import { version as stylelintVersion } from 'stylelint/package.json';
import semver from 'semver';

const createDocument = (uri: string | null, languageId: string, contents: string): TextDocument =>
	TextDocument.create(
		uri ? pathToFileURL(resolve(__dirname, '..', uri)).toString() : 'Untitled:Untitled',
		languageId,
		1,
		contents,
	);

describe('StylelintRunner', () => {
	test('should be resolved with diagnostics when it lints CSS successfully', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument(null, 'css', '  a[id="id"]{}'), {
			config: {
				rules: {
					'string-quotes': ['single', { severity: 'warning' }],
					indentation: ['tab'],
				},
			},
		});

		expect(result.diagnostics).toMatchSnapshot();
	});

	test('should be resolved with an empty array when no errors and warnings are reported', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument(null, 'scss', ''), {
			config: {
				customSyntax: 'postcss-scss',
				rules: { indentation: [2] },
			},
		});

		expect(result.diagnostics).toEqual([]);
	});

	test('should be resolved with one diagnostic when the CSS is broken', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		// TODO: Restore once postcss-markdown is PostCSS 8 compatible
		// 		const result = await runner.lintDocument(
		// 			createDocument(
		// 				'markdown.md',
		// 				'markdown',
		// 				`# Title

		// # Code block

		// \`\`\`css
		//           a{
		// \`\`\`
		// `,
		// 			),
		// 			{
		// 				config: {
		// 					customSyntax: 'postcss-markdown',
		// 					rules: {
		// 						indentation: ['tab'],
		// 					},
		// 				},
		// 			},
		// 		);
		const result = await runner.lintDocument(
			createDocument('scss.scss', 'scss', '          a{\n'),
			{
				config: {
					customSyntax: 'postcss-scss',
					rules: {
						indentation: ['tab'],
					},
				},
			},
		);

		expect(result.diagnostics).toMatchSnapshot();
	});

	test('should be resolved even if no configs are defined', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		// TODO: Restore once postcss-html is PostCSS 8 compatible
		// const result = await runner.lintDocument(createDocument(null, 'plaintext', '<style>a{}</style>'), {
		// 	customSyntax: 'postcss-html',
		// });
		const result = await runner.lintDocument(createDocument(null, 'plaintext', 'a{}'), {
			customSyntax: 'postcss-scss',
		});

		expect(result.diagnostics).toEqual([]);
	});

	test('should support `.stylelintignore`.', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument('listed-in-stylelintignore.css', 'css', '}'),
			{
				ignorePath: require.resolve('./.stylelintignore'),
			},
		);

		expect(result.diagnostics).toEqual([]);
	});

	test('should support CSS-in-JS with customSyntax', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument(
				null,
				'javascript',
				`import glamorous from 'glamorous';
const styled = require("styled-components");
const A = glamorous.a({font: 'bold'});
const B = styled.b\`
font: normal
\`;`,
			),
			{
				config: {
					customSyntax: '@stylelint/postcss-css-in-js',
					rules: { 'font-weight-notation': ['numeric'] },
				},
			},
		);

		expect(result.diagnostics).toEqual([
			{
				code: 'font-weight-notation',
				codeDescription: {
					href: 'https://stylelint.io/user-guide/rules/font-weight-notation',
				},
				message: semver.satisfies(stylelintVersion, '>=15')
					? 'Expected "bold" to be "700" (font-weight-notation)'
					: 'Expected numeric font-weight notation (font-weight-notation)',
				range: {
					end: {
						character: 30,
						line: 2,
					},
					start: {
						character: 29,
						line: 2,
					},
				},
				severity: 1,
				source: 'Stylelint',
			},
			{
				code: 'font-weight-notation',
				codeDescription: {
					href: 'https://stylelint.io/user-guide/rules/font-weight-notation',
				},
				message: semver.satisfies(stylelintVersion, '>=15')
					? 'Expected "normal" to be "400" (font-weight-notation)'
					: 'Expected numeric font-weight notation (font-weight-notation)',
				range: {
					end: {
						character: 7,
						line: 4,
					},
					start: {
						character: 6,
						line: 4,
					},
				},
				severity: 1,
				source: 'Stylelint',
			},
		]);
	});

	test('should set `codeFilename` option from a TextDocument', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument(
				'should-be-ignored.xml',
				'xml',
				`<style>
a { color: #000 }
</style>`,
			),
			{
				config: {
					rules: {
						'color-hex-length': 'long',
					},
					ignoreFiles: '**/*-ignored.xml',
				},
			},
		);

		expect(result.diagnostics).toEqual([]);
	});

	if (semver.satisfies(stylelintVersion, '^14')) {
		test('should support `processors` option', async () => {
			expect.assertions(1);
			const runner = new StylelintRunner();
			const result = await runner.lintDocument(
				createDocument('processors.tsx', 'typescriptreact', 'styled.p`"`'),
				{
					config: {
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- for stylelint v14
						// @ts-ignore for stylelint v14
						processors: ['stylelint-processor-styled-components'],
						rules: {},
					},
				},
			);

			expect(result.diagnostics).toEqual([
				{
					code: 'CssSyntaxError',
					message: 'Unclosed string (CssSyntaxError)',
					range: {
						end: {
							character: 10,
							line: 0,
						},
						start: {
							character: 9,
							line: 0,
						},
					},
					severity: 1,
					source: 'Stylelint',
				},
			]);
		});
	}

	test('should check CSS syntax even if no configuration is provided', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument('unclosed.css', 'css', 'a{color:rgba(}'),
		);

		expect(result.diagnostics).toMatchSnapshot();
	});

	test('should check CSS syntax even if no rule is provided', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		// TODO: Restore once postcss-html is PostCSS 8 compatible
		// const result = await runner.lintDocument(createDocument('at.xsl', 'xsl', '<style>@</style>'), {
		// 	customSyntax: 'postcss-html',
		// });
		const result = await runner.lintDocument(createDocument('at.scss', 'scss', '@'), {
			customSyntax: 'postcss-scss',
		});

		expect(result.diagnostics).toMatchSnapshot();
	});

	test('should be resolved even if no rules are defined', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument('no-rules.css', 'css', 'a{}'), {
			config: {},
		});

		expect(result.diagnostics).toEqual([]);
	});

	test('should reject with a reason when it takes incorrect options', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const promise = runner.lintDocument(
			createDocument('invalid-options.css', 'css', '  a[id="id"]{}'),
			{
				config: {
					rules: {
						'string-quotes': 'single',
						'color-hex-case': 'foo',
						'at-rule-empty-line-before': ['always', { bar: true }],
					},
				},
			},
		);

		await expect(promise).rejects.toThrowErrorMatchingSnapshot();
	});

	test('should be resolved with diagnostics when the rules include unknown rules', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument('unknown-rule.css', 'css', 'b{}'), {
			config: {
				rules: {
					'this-rule-does-not-exist': 1,
					'this-rule-also-does-not-exist': 1,
				},
			},
		});

		expect(result.diagnostics).toMatchSnapshot();
	});

	test('should be resolved with diagnostic plugin rule URL', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument('unknown-rule.scss', 'scss', '@unknown (max-width: 960px) {}'),
			{
				config: {
					plugins: ['stylelint-scss'],
					rules: {
						'scss/at-rule-no-unknown': true,
					},
				},
			},
		);

		expect(result.diagnostics).toMatchSnapshot();
	});
});

describe('StylelintRunner with a configuration file', () => {
	test('should adhere to configuration file settings', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument(
				join(__dirname, 'has-config-file.tsx'),
				'typescriptreact',
				`
const what: string = "is this";
<a css={{
  width: "0px",
  what
}} />;
`,
			),
			{ configFile: join(__dirname, 'no-unknown.config.js') },
		);

		expect(result.diagnostics).toMatchSnapshot();
	});
});

describe('StylelintRunner with auto-fix', () => {
	test('auto-fix should work properly if configs are defined', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument(null, 'css', 'a\n{\ncolor:red;\n}'), {
			config: { rules: { indentation: [2] } },
			fix: true,
		});

		expect(result.output).toMatchSnapshot();
	});

	test('auto-fix should only work properly for syntax errors if no rules are defined', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument('no-rules.css', 'css', 'a {'), {
			config: {},
			fix: true,
		});

		expect(result.output).toMatchInlineSnapshot(`"a {}"`);
	});

	test('JS file auto-fix should not change the content if no rules are defined', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument('no-rules.js', 'javascript', '"a"'), {
			customSyntax: '@stylelint/postcss-css-in-js',
			config: {},
			fix: true,
		});

		expect(result.output).toMatchInlineSnapshot(`"\\"a\\""`);
	});

	test('auto-fix should ignore if the file matches the ignoreFiles', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument('should-be-ignored.js', 'javascript', '"a"'),
			{
				customSyntax: '@stylelint/postcss-css-in-js',
				config: {
					rules: {},
					ignoreFiles: '**/*-ignored.js',
				},
				fix: true,
			},
		);

		expect(result.output).toBeUndefined();
	});

	test('auto-fix should work if there is syntax errors in css', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument(
				'test.css',
				'css',
				`
.a {
	width: 100%
	height: 100%;
}
`,
			),
			{
				config: { rules: {} },
				fix: true,
			},
		);

		expect(result.output).toMatchSnapshot();
	});

	test('auto-fix should ignore if there is syntax errors in scss', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument(
				'test.scss',
				'scss',
				`
.a {
	width: 100%
	height: 100%;
}
`,
			),
			{
				customSyntax: 'postcss-scss',
				config: { rules: {} },
				fix: true,
			},
		);

		expect(result.output).toBeUndefined();
	});

	test('auto-fix should work if there are errors that cannot be auto-fixed', async () => {
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument(
				'test.css',
				'css',
				`
unknown {
    width: 100%;
    height: 100%;
}
`,
			),
			{
				config: {
					rules: {
						indentation: 2,
						'selector-type-no-unknown': true,
					},
				},
				fix: true,
			},
		);

		expect(result).toMatchSnapshot();
	});
});

describe('StylelintRunner with customSyntax', () => {
	test('should work properly if customSyntax is defined', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument('test.css', 'css', 'a\n   color:red'), {
			config: { rules: { indentation: [2] } },
			customSyntax: 'postcss-sass',
		});

		expect(result).toMatchSnapshot();
	});

	test('auto-fix should work properly if customSyntax is defined', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument('test.css', 'css', 'a\n   color:red'), {
			config: { rules: { indentation: [2] } },
			customSyntax: 'postcss-sass',
			fix: true,
		});

		expect(result).toMatchSnapshot();
	});
});

describe('StylelintRunner with reportDescriptionlessDisables', () => {
	test('should work properly if reportDescriptionlessDisables is true', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument(
				'test.css',
				'css',
				`
.baz {
    /* stylelint-disable-next-line indentation */
  color: red;
}
/* stylelint-disable indentation */
.baz {
  color: red;
}
/* stylelint-enable indentation */
.baz {
  color: red; /* stylelint-disable-line indentation */
}

.baz {
    /* stylelint-disable-next-line indentation -- with a description */
  color: red;
}
/* stylelint-disable indentation -- with a description */
.baz {
  color: red;
}
/* stylelint-enable indentation */
.baz {
  color: red; /* stylelint-disable-line indentation -- with a description */
}
`,
			),
			{
				config: { rules: { indentation: [4] } },
				reportDescriptionlessDisables: true,
			},
		);

		expect(result).toMatchSnapshot();
	});
});

describe('StylelintRunner with reportNeedlessDisables', () => {
	test('should work properly if reportNeedlessDisables is true', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument(
				'test.css',
				'css',
				`
.foo {
  /* stylelint-disable-next-line indentation */
    color: red;
}

/* stylelint-disable indentation */
.bar {
    color: red;
}
/* stylelint-enable indentation */

.baz {
    color: red; /* stylelint-disable-line indentation */
}

/* stylelint-disable indentation */
.bar {
    color: red;
}
`,
			),
			{
				config: { rules: { indentation: [4] } },
				reportNeedlessDisables: true,
			},
		);

		expect(result).toMatchSnapshot();
	});
});

describe('StylelintRunner with reportInvalidScopeDisables', () => {
	test('should work properly if reportInvalidScopeDisables is true', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument(
				'test.css',
				'css',
				`
/* stylelint-disable-next-line foo */

/* stylelint-disable-line foo */

/* stylelint-disable foo */
/* stylelint-enable foo */

/* stylelint-disable-next-line indentation */

/* stylelint-disable-line indentation */

/* stylelint-disable indentation */
/* stylelint-enable indentation */
`,
			),
			{
				config: { rules: { indentation: [4] } },
				reportInvalidScopeDisables: true,
			},
		);

		expect(result).toMatchSnapshot();
	});
});

describe('StylelintRunner with stylelintPath', () => {
	test('should work properly if stylelintPath is defined', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument('test.css', 'css', 'a{\n   color:red}'),
			{
				config: { rules: { indentation: [2] } },
			},
			{
				stylelintPath: resolve(__dirname, '../../../node_modules/stylelint'),
			},
		);

		expect(result).toMatchSnapshot();
	});

	test('should work properly if custom path is defined in stylelintPath', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(
			createDocument('test.css', 'css', 'a{\n   color:red}'),
			{
				config: { rules: { indentation: [2] } },
			},
			{
				stylelintPath: require.resolve('./fake-stylelint'),
			},
		);

		expect(result).toMatchSnapshot();
	});
});
