import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { StylelintRunner } from '../../../src/utils/stylelint/index';
import { version as stylelintVersion } from 'stylelint/package.json';
import { version as stylelintScssVersion } from 'stylelint-scss/package.json';
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
		const result = await runner.lintDocument(createDocument(null, 'css', '  foo { color: #y3 }'), {
			config: {
				rules: {
					'color-no-invalid-hex': [true],
					'selector-type-no-unknown': [true],
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
				rules: { 'color-no-invalid-hex': [true] },
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
			createDocument('scss.scss', 'scss', '          a{color: #y3\n'),
			{
				config: {
					customSyntax: 'postcss-scss',
					rules: {
						'color-no-invalid-hex': [true],
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

		expect(result.diagnostics).toMatchSnapshot();
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

	test('should surface configuration error when no rules are defined and fix is not enabled', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument('no-rules.css', 'css', 'a{}'), {
			config: {},
		});

		// Should get the configuration error diagnostic.
		expect(result.diagnostics).toEqual([
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 0 },
				},
				message: 'No rules found within configuration. Have you provided a "rules" property?',
				severity: 1,
				source: 'Stylelint',
				code: 'no-rules-configured',
			},
		]);
	});

	test('should surface both syntax errors and configuration error when no rules are defined', async () => {
		expect.assertions(3);
		const runner = new StylelintRunner();
		// Invalid CSS syntax, missing closing brace.
		const result = await runner.lintDocument(createDocument('no-rules.css', 'css', 'a{color:red'), {
			config: {},
		});

		// Should get both syntax errors and the configuration error.
		expect(result.diagnostics.length).toBeGreaterThan(1);

		// Should have the configuration error.
		const configError = result.diagnostics.find((d) => d.code === 'no-rules-configured');

		expect(configError).toEqual({
			range: {
				start: { line: 0, character: 0 },
				end: { line: 0, character: 0 },
			},
			message: 'No rules found within configuration. Have you provided a "rules" property?',
			severity: 1,
			source: 'Stylelint',
			code: 'no-rules-configured',
		});

		// Should also have syntax errors.
		const syntaxErrors = result.diagnostics.filter((d) => d.code !== 'no-rules-configured');

		expect(syntaxErrors.length).toBeGreaterThan(0);
	});

	test('should surface configuration error when no rules are defined when auto-fixing', async () => {
		expect.assertions(2);
		const runner = new StylelintRunner();
		// Invalid CSS syntax, missing closing brace.
		const result = await runner.lintDocument(createDocument('no-rules.css', 'css', 'a{color:red'), {
			config: {},
			fix: true,
		});

		// Should have the configuration error.
		const configError = result.diagnostics.find((d) => d.code === 'no-rules-configured');

		expect(configError).toEqual({
			range: {
				start: { line: 0, character: 0 },
				end: { line: 0, character: 0 },
			},
			message: 'No rules found within configuration. Have you provided a "rules" property?',
			severity: 1,
			source: 'Stylelint',
			code: 'no-rules-configured',
		});

		// When auto-fixing is enabled, syntax errors should be fixed and not reported as diagnostics,
		// so we should only have the configuration error left.
		expect(result.diagnostics).toHaveLength(1);
	});

	test('should work normally when rules are defined', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument('with-rules.css', 'css', 'a{}'), {
			config: {
				rules: {
					'block-no-empty': true,
				},
			},
		});

		expect(result.diagnostics).toEqual([
			{
				code: 'block-no-empty',
				codeDescription: {
					href: 'https://stylelint.io/user-guide/rules/block-no-empty',
				},
				message: 'Unexpected empty block (block-no-empty)',
				range: {
					end: {
						character: 3,
						line: 0,
					},
					start: {
						character: 1,
						line: 0,
					},
				},
				severity: 1,
				source: 'Stylelint',
			},
		]);
	});

	test('should reject with a reason when it takes incorrect options', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const promise = runner.lintDocument(
			createDocument('invalid-options.css', 'css', '  foo { color: #y3 }'),
			{
				config: {
					rules: {
						'color-no-invalid-hex': true,
						'color-hex-alpha': 'foo',
						'selector-type-no-unknown': [true, { bar: true }],
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

	if (semver.satisfies(stylelintScssVersion, '^15')) {
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

			expect(result.diagnostics).toEqual([
				{
					code: 'scss/at-rule-no-unknown',
					codeDescription: {
						href: 'https://github.com/stylelint-scss/stylelint-scss/blob/master/src/rules/at-rule-no-unknown',
					},
					message: 'Unexpected unknown at-rule "@unknown" (scss/at-rule-no-unknown)',
					range: {
						end: {
							character: 8,
							line: 0,
						},
						start: {
							character: 0,
							line: 0,
						},
					},
					severity: 1,
					source: 'Stylelint',
				},
			]);
		});
	}
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
		const result = await runner.lintDocument(
			createDocument(null, 'css', 'a\n{\ncolor:#ffffff;\n}'),
			{
				config: { rules: { 'color-hex-length': 'short' } },
				fix: true,
			},
		);

		expect(result.output).toMatchSnapshot();
	});

	test('auto-fix should only work properly for syntax errors if no rules are defined', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument('no-rules.css', 'css', 'a {'), {
			config: {},
			fix: true,
		});

		expect(result.output).toBe('a {}');
	});

	test('JS file auto-fix should not change the content if no rules are defined', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();
		const result = await runner.lintDocument(createDocument('no-rules.js', 'javascript', '"a"'), {
			customSyntax: '@stylelint/postcss-css-in-js',
			config: {},
			fix: true,
		});

		expect(result.output).toBe('"a"');
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
    color: #ffffff
    background-color: #ffffffaa;
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
    color: #ffffff
    background-color: #ffffffaa;
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
    color: #ffffff;
    background-color: #ffffffaa;
}
`,
			),
			{
				config: {
					rules: {
						'color-hex-length': 'short',
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
		const result = await runner.lintDocument(
			createDocument('test.css', 'css', 'a\n  color:#ffffff'),
			{
				config: { rules: { 'color-hex-length': 'short' } },
				customSyntax: 'postcss-sass',
			},
		);

		expect(result).toMatchSnapshot();
	});

	test('auto-fix should work properly if customSyntax is defined', async () => {
		expect.assertions(1);
		const runner = new StylelintRunner();

		try {
			const result = await runner.lintDocument(
				createDocument('test.css', 'css', 'a\n  color:#ffffff'),
				{
					config: { rules: { 'color-hex-length': 'short' } },
					customSyntax: 'postcss-sass',
					fix: true,
				},
			);

			expect(result).toMatchSnapshot();
		} catch (e) {
			console.error(e);
		}
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
    /* stylelint-disable-next-line color-no-invalid-hex */
  color: #y3;
}
/* stylelint-disable color-no-invalid-hex */
.baz {
  color: #y3;
}
/* stylelint-enable color-no-invalid-hex */
.baz {
  color: #y3; /* stylelint-disable-line color-no-invalid-hex */
}

.baz {
    /* stylelint-disable-next-line color-no-invalid-hex -- with a description */
  color: #y3;
}
/* stylelint-disable color-no-invalid-hex -- with a description */
.baz {
  color: #y3;
}
/* stylelint-enable color-no-invalid-hex */
.baz {
  color: #y3; /* stylelint-disable-line color-no-invalid-hex -- with a description */
}
`,
			),
			{
				config: { rules: { 'color-no-invalid-hex': [true] } },
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
    background-color: #y3; /* stylelint-disable-next-line color-no-invalid-hex */
    color: red;
}

/* stylelint-disable color-no-invalid-hex */
.bar {
    color: red;
}
/* stylelint-enable color-no-invalid-hex */

.baz {
    color: red; /* stylelint-disable-line color-no-invalid-hex */
}

/* stylelint-disable color-no-invalid-hex */
.bar {
    color: red;
}
`,
			),
			{
				config: { rules: { 'color-no-invalid-hex': [true] } },
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

/* stylelint-disable-next-line color-no-invalid-hex */

/* stylelint-disable-line color-no-invalid-hex */

/* stylelint-disable color-no-invalid-hex */
/* stylelint-enable color-no-invalid-hex */
`,
			),
			{
				config: { rules: { 'color-no-invalid-hex': [true] } },
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
			createDocument('test.css', 'css', 'a{\n  color:#y3}'),
			{
				config: { rules: { 'color-no-invalid-hex': [true] } },
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
			createDocument('test.css', 'css', 'a{\n  color:#y3}'),
			{
				config: { rules: { 'color-no-invalid-hex': [true] } },
			},
			{
				stylelintPath: require.resolve('./fake-stylelint'),
			},
		);

		expect(result).toMatchSnapshot();
	});
});
