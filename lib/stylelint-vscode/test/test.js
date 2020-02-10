'use strict';

const { join, resolve } = require('path');
const { pathToFileURL } = require('url');

const createDocument = require('vscode-languageserver').TextDocument.create;
const stylelintVSCode = require('..');
const test = require('tape');

// https://github.com/Microsoft/vscode-languageserver-node/blob/release/types/3.14/types/src/main.ts#L488-L495
const ERROR = 1;
const WARNING = 2;

class Document {
	constructor(uri, languageId, contents) {
		return createDocument(
			uri ? pathToFileURL(resolve(__dirname, '..', uri)).toString() : 'Untitled:Untitled',
			languageId,
			1,
			contents,
		);
	}
}

test('stylelintVSCode()', async (t) => {
	process.chdir(resolve(__dirname, '../../..'));

	t.plan(18);

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document(null, 'css', '  a[id="id"]{}'), {
				config: {
					rules: {
						'string-quotes': ['single', { severity: 'warning' }],
						indentation: ['tab'],
					},
				},
			}).then((r) => r.diagnostics),
			[
				{
					range: {
						start: {
							line: 0,
							character: 7,
						},
						end: {
							line: 0,
							character: 7,
						},
					},
					message: 'Expected single quotes (string-quotes)',
					severity: WARNING,
					code: 'string-quotes',
					source: 'stylelint',
				},
				{
					range: {
						start: {
							line: 0,
							character: 2,
						},
						end: {
							line: 0,
							character: 2,
						},
					},
					message: 'Expected indentation of 0 tabs (indentation)',
					severity: ERROR,
					code: 'indentation',
					source: 'stylelint',
				},
			],
			'should be resolved with diagnostics when it lints CSS successfully.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document(null, 'scss', ''), {
				config: { rules: { indentation: [2] } },
			}).then((r) => r.diagnostics),
			[],
			'should be resolved with an empty array when no errors and warnings are reported.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(
				new Document(
					'markdown.md',
					'markdown',
					`# Title

# Code block

\`\`\`css
          a{
\`\`\`
`,
				),
				{
					config: {
						rules: {
							indentation: ['tab'],
						},
					},
				},
			).then((r) => r.diagnostics),
			[
				{
					range: {
						start: {
							line: 5,
							character: 10,
						},
						end: {
							line: 5,
							character: 10,
						},
					},
					message: 'Unclosed block (CssSyntaxError)',
					severity: ERROR,
					code: 'CssSyntaxError',
					source: 'stylelint',
				},
			],
			'should be resolved with one diagnostic when the CSS is broken.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document(null, 'plaintext', '<style>a{}</style>'), {
				syntax: 'html',
			}).then((r) => r.diagnostics),
			[],
			'should be resolved even if no configs are defined.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document('listed-in-stylelintignore.css', 'css', '}'), {
				ignorePath: require.resolve('./.stylelintignore'),
			}).then((r) => r.diagnostics),
			[],
			'should support `.stylelintignore`.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document('single-line-comment.scss', 'scss', '//Hi'), {
				syntax: 'scss',
				config: {
					rules: {},
				},
			}).then((r) => r.diagnostics),
			[],
			'should support non-standard CSS syntax with `syntax` option.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(
				new Document(
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
					config: { rules: { 'font-weight-notation': ['numeric'] } },
				},
			).then((r) => r.diagnostics),
			[
				{
					range: {
						start: {
							line: 2,
							character: 29,
						},
						end: {
							line: 2,
							character: 29,
						},
					},
					message: 'Expected numeric font-weight notation (font-weight-notation)',
					severity: 1,
					code: 'font-weight-notation',
					source: 'stylelint',
				},
				{
					range: {
						start: {
							line: 4,
							character: 6,
						},
						end: {
							line: 4,
							character: 6,
						},
					},
					message: 'Expected numeric font-weight notation (font-weight-notation)',
					severity: 1,
					code: 'font-weight-notation',
					source: 'stylelint',
				},
			],
			'should support CSS-in-JS.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(
				new Document(
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
			).then((r) => r.diagnostics),
			[],
			'should set `codeFilename` option from a TextDocument.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document('processors.tsx', 'typescriptreact', 'styled.p`"`'), {
				config: {
					processors: ['stylelint-processor-styled-components'],
					rules: {},
				},
			}).then((r) => r.diagnostics),
			[
				{
					range: {
						start: {
							line: 0,
							character: 9,
						},
						end: {
							line: 0,
							character: 9,
						},
					},
					message: 'Unclosed string (CssSyntaxError)',
					severity: ERROR,
					code: 'CssSyntaxError',
					source: 'stylelint',
				},
			],
			'should support `processors` option.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(
				new Document('unclosed.xml', 'xml', '<style>a{color:rgba(}</style>'),
			).then((r) => r.diagnostics),
			[
				{
					range: {
						start: {
							line: 0,
							character: 19,
						},
						end: {
							line: 0,
							character: 19,
						},
					},
					message: 'Unclosed bracket (CssSyntaxError)',
					severity: ERROR,
					code: 'CssSyntaxError',
					source: 'stylelint',
				},
			],
			'should check CSS syntax even if no configration is provided.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document('at.xsl', 'xsl', '<style>@</style>')).then(
				(r) => r.diagnostics,
			),
			[
				{
					range: {
						start: {
							line: 0,
							character: 7,
						},
						end: {
							line: 0,
							character: 7,
						},
					},
					message: 'At-rule without name (CssSyntaxError)',
					severity: ERROR,
					code: 'CssSyntaxError',
					source: 'stylelint',
				},
			],
			'should check CSS syntax even if no rule is provided.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document('no-rules.css', 'css', 'a{}'), { config: {} }).then(
				(r) => r.diagnostics,
			),
			[],
			'should be resolved even if no rules are defined.',
		);
	})();

	const fail = t.fail.bind(t, 'Unexpectedly succeeded.');

	(async () => {
		try {
			await stylelintVSCode(new Document('invalid-options.css', 'css', '  a[id="id"]{}'), {
				config: {
					rules: {
						'string-quotes': 'single',
						'color-hex-case': 'foo',
						'at-rule-empty-line-before': ['always', { bar: true }],
					},
				},
			});
			fail();
		} catch ({ message, reasons }) {
			const expected = [
				'Invalid option name "bar" for rule "at-rule-empty-line-before"',
				'Invalid option value "foo" for rule "color-hex-case"',
			];

			t.equal(message, expected.join('\n'), 'should be rejected when it takes incorrect options.');

			t.deepEqual(
				reasons,
				expected,
				'should add `reason` property to the error when it takes incorrect options.',
			);
		}
	})();

	t.deepEqual(
		await stylelintVSCode(new Document('unknown-rule.css', 'css', 'b{}'), {
			config: {
				rules: {
					'this-rule-does-not-exist': 1,
					'this-rule-also-does-not-exist': 1,
				},
			},
		}).then((r) => r.diagnostics),
		[
			{
				range: {
					start: {
						line: 0,
						character: 0,
					},
					end: {
						line: 0,
						character: 0,
					},
				},
				message: 'Unknown rule this-rule-does-not-exist.',
				severity: ERROR,
				code: 'this-rule-does-not-exist',
				source: 'stylelint',
			},
			{
				range: {
					start: {
						line: 0,
						character: 0,
					},
					end: {
						line: 0,
						character: 0,
					},
				},
				message: 'Unknown rule this-rule-also-does-not-exist.',
				severity: ERROR,
				code: 'this-rule-also-does-not-exist',
				source: 'stylelint',
			},
		],
		'should be resolved with diagnostics when the rules include unknown rules.',
	);

	try {
		await stylelintVSCode(Symbol('!'));
		fail();
	} catch ({ message }) {
		t.equal(
			message,
			'Expected a TextDocument https://code.visualstudio.com/docs/extensionAPI/vscode-api#TextDocument, but got Symbol(!).',
			'should be rejected when the first argument is not a TextDocument.',
		);
	}

	try {
		await stylelintVSCode(new Document('_', 'css', ''), Buffer.from('1'));
		fail();
	} catch ({ message }) {
		t.equal(
			message,
			'Expected an object containing stylelint API options, but got <Buffer 31>.',
			'should be rejected when the second argument is not a plain object.',
		);
	}

	try {
		await stylelintVSCode(new Document('_', 'css', ''), { files: ['src/*.css'] });
		fail();
	} catch ({ message }) {
		t.ok(
			message.startsWith(
				'`code`, `codeFilename`, `files` and `formatter` options are not supported ',
			),
			'should be rejected when `files` option is provided.',
		);
	}
});

test('stylelintVSCode() with a configration file', async (t) => {
	process.chdir(__dirname);

	t.deepEqual(
		await stylelintVSCode(
			new Document(
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
			{
				configOverrides: {
					rules: {
						'property-no-unknown': [
							true,
							{
								ignoreProperties: 'what',
							},
						],
					},
				},
			},
		).then((r) => r.diagnostics),
		[
			{
				range: {
					start: {
						line: 3,
						character: 10,
					},
					end: {
						line: 3,
						character: 10,
					},
				},
				message: 'Unexpected unit (length-zero-no-unit)',
				severity: ERROR,
				code: 'length-zero-no-unit',
				source: 'stylelint',
			},
		],
		'should adhere configuration file settings.',
	);

	t.end();
});

test('stylelintVSCode() with autofix', async (t) => {
	process.chdir(resolve(__dirname, '../../..'));

	t.plan(9);

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document(null, 'css', 'a\n{\ncolor:red;\n}'), {
				config: { rules: { indentation: [2] } },
				fix: true,
			}).then((r) => r.output),
			'a\n{\n  color:red;\n}',
			'The autofix should work properly if configs are defined.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document(null, 'css', 'a\n{\ncolor:red;;\n}'), {
				config: { rules: { 'no-extra-semicolons': true } },
				fix: true,
			}).then((r) => r.output),
			'a\n{\ncolor:red;\n}',
			'The autofix should work properly if configs are defined.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document(null, 'css', 'a\n{\ncolor:red\n}'), {
				config: { rules: { 'declaration-block-trailing-semicolon': ['always'] } },
				fix: true,
			}).then((r) => r.output),
			'a\n{\ncolor:red;\n}',
			'The autofix should work properly if configs are defined.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document(null, 'css', 'a\n{\ncolor:red;\n}'), {
				config: { rules: { 'declaration-block-trailing-semicolon': ['never'] } },
				fix: true,
			}).then((r) => r.output),
			'a\n{\ncolor:red\n}',
			'The autofix should work properly if configs are defined.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document('no-rules.css', 'css', 'a {'), {
				config: {},
				fix: true,
			}).then((r) => r.output),
			'a {}',
			'The autofix should only work properly for syntax errors if no rules are defined.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document('no-rules.js', 'javascript', '"a"'), {
				config: {},
				fix: true,
			}).then((r) => r.output),
			'"a"',
			'The JS file autofix should not change the content if no rules are defined.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(new Document('should-be-ignored.js', 'javascript', '"a"'), {
				config: {
					rules: {},
					ignoreFiles: '**/*-ignored.js',
				},
				fix: true,
			}).then((r) => r.output),
			undefined,
			'The autofix should ignore if the file matches the ignoreFiles.',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(
				new Document(
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
			).then((r) => r.output),
			`
.a {
	width: 100%;
	height: 100%
}
`,
			'The autofix should work if there is syntax errors in css',
		);
	})();

	(async () => {
		t.deepEqual(
			await stylelintVSCode(
				new Document(
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
					config: { rules: {} },
					fix: true,
				},
			).then((r) => r.output),
			undefined,
			'The autofix should ignore if there is syntax errors in scss.',
		);
	})();
});
