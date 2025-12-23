import fs from 'node:fs/promises';
import path from 'node:path';
import type stylelint from 'stylelint';
import { pathToFileURL } from 'url';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Connection } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { createContainer } from '../../../src/di/index.js';
import {
	StylelintRunnerService,
	WorkspaceStylelintService,
} from '../../../src/server/services/index.js';
import type { LintDiagnostics, RunnerOptions } from '../../../src/server/stylelint/index.js';
import { platformModule } from '../../../src/server/modules/platform.module.js';
import { stylelintRuntimeModule } from '../../../src/server/modules/stylelint-runtime.module.js';
import { workspaceModule } from '../../../src/server/modules/workspace.module.js';
import { lspConnectionToken } from '../../../src/server/tokens.js';
import { loggingServiceToken } from '../../../src/server/services/infrastructure/logging.service.js';
import {
	StylelintWorkerCrashedError,
	StylelintWorkerUnavailableError,
} from '../../../src/server/worker/worker-process.js';
import {
	createLoggingServiceStub,
	snapshotLintDiagnostics,
	testOnVersion,
} from '../../helpers/index.js';

const createDocument = (uri: string | null, languageId: string, contents: string): TextDocument =>
	TextDocument.create(
		uri ? pathToFileURL(path.resolve(__dirname, '..', uri)).toString() : 'Untitled:Untitled',
		languageId,
		1,
		contents,
	);

const getFixedText = (result: LintDiagnostics): string | undefined =>
	result.code ?? (result.output && result.output.length > 0 ? result.output : undefined);

type StylelintDiagnostic = LintDiagnostics['diagnostics'][number];

const testConnection = {
	workspace: {
		async getWorkspaceFolders() {
			return null;
		},
	},
} as unknown as Connection;

const createTestContainerInstance = () =>
	createContainer([platformModule, stylelintRuntimeModule, workspaceModule], {
		overrides: [
			[lspConnectionToken, testConnection],
			[loggingServiceToken, createLoggingServiceStub()],
		],
	});

const testContainer = createTestContainerInstance();

const sharedWorkspaceService = testContainer.resolve(WorkspaceStylelintService);

const resolveStylelintRunner = (): StylelintRunnerService =>
	testContainer.resolve(StylelintRunnerService);

afterAll(() => {
	sharedWorkspaceService.disposeAll();
});

describe('StylelintRunner', () => {
	test('should be resolved with diagnostics when it lints CSS successfully', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
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
		const runner = resolveStylelintRunner();
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
		const runner = resolveStylelintRunner();
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
		const runner = resolveStylelintRunner();
		const result = await runner.lintDocument(createDocument(null, 'plaintext', 'a{}'), {
			customSyntax: 'postcss-scss',
		});

		expect(result.diagnostics).toEqual([]);
	});

	test('should support `.stylelintignore`.', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
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
		const runner = resolveStylelintRunner();
		const result = await runner.lintDocument(
			createDocument(null, 'javascript', 'styled.a` font: normal `;'),
			{
				config: {
					customSyntax: 'postcss-styled-syntax',
					rules: { 'font-weight-notation': ['numeric'] },
				},
			},
		);

		expect(result.diagnostics).toMatchSnapshot();
	});

	test('should set `codeFilename` option from a TextDocument', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
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

	testOnVersion('^14', 'should support `processors` option', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
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

	test('should check CSS syntax even if no configuration is provided', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
		const result = await runner.lintDocument(
			createDocument('unclosed.css', 'css', 'a{color:rgba(}'),
		);

		expect(result.diagnostics).toMatchSnapshot();
	});

	test('should check CSS syntax even if no rule is provided', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
		const result = await runner.lintDocument(createDocument('at.xsl', 'xsl', '<style>@</style>'), {
			customSyntax: 'postcss-html',
		});

		expect(result.diagnostics).toMatchSnapshot();
	});

	test('should surface configuration error when no rules are defined and fix is not enabled', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
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
		const runner = resolveStylelintRunner();
		// Invalid CSS syntax, missing closing brace.
		const result = await runner.lintDocument(createDocument('no-rules.css', 'css', 'a{color:red'), {
			config: {},
		});

		// Should get both syntax errors and the configuration error.
		expect(result.diagnostics.length).toBeGreaterThan(1);

		// Should have the configuration error.
		const configError = result.diagnostics.find(
			(diagnostic: StylelintDiagnostic) => diagnostic.code === 'no-rules-configured',
		);

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
		const syntaxErrors = result.diagnostics.filter(
			(diagnostic: StylelintDiagnostic) => diagnostic.code !== 'no-rules-configured',
		);

		expect(syntaxErrors.length).toBeGreaterThan(0);
	});

	testOnVersion(
		'<17',
		'should surface configuration error when no rules are defined when auto-fixing',
		async () => {
			expect.assertions(2);
			const runner = resolveStylelintRunner();
			// Invalid CSS syntax, missing closing brace.
			const result = await runner.lintDocument(
				createDocument('no-rules.css', 'css', 'a{color:red'),
				{
					config: {},
					fix: true,
				},
			);

			// Should have the configuration error.
			const configError = result.diagnostics.find(
				(diagnostic: StylelintDiagnostic) => diagnostic.code === 'no-rules-configured',
			);

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
		},
	);

	testOnVersion(
		'>=17',
		'(>= Stylelint 17) should surface configuration error when no rules are defined when auto-fixing',
		async () => {
			expect.assertions(2);
			const runner = resolveStylelintRunner();
			// Invalid CSS syntax, missing closing brace.
			const result = await runner.lintDocument(
				createDocument('no-rules.css', 'css', 'a{color:red'),
				{
					config: {},
					fix: true,
				},
			);

			// Should have the configuration error.
			const configError = result.diagnostics.find(
				(diagnostic: StylelintDiagnostic) => diagnostic.code === 'no-rules-configured',
			);

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

			// When auto-fixing is enabled on Stylelint 17+, syntax errors
			// should still be reported as diagnostics, so we should have both
			// the syntax error and the configuration error.
			expect(result.diagnostics).toHaveLength(2);
		},
	);

	test('should work normally when rules are defined', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
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
		const runner = resolveStylelintRunner();
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
		const runner = resolveStylelintRunner();
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

	testOnVersion('^15', 'should be resolved with diagnostic plugin rule URL', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
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
});

describe('StylelintRunner with a configuration file', () => {
	test('should adhere to configuration file settings', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
		const result = await runner.lintDocument(
			createDocument('has-config-file.tsx', 'typescriptreact', 'styled.a` width: 0px `;'),
			{ configFile: path.join(__dirname, 'no-unknown.config.js') },
		);

		expect(result.diagnostics).toMatchSnapshot();
	});
});

describe('WorkspaceStylelintService worker crash handling', () => {
	const crashRuleName = 'stylelint-crash/force-worker-crash';
	const pluginPath = require.resolve('../../shared/stylelint-crash-plugin');
	const workspaceFolder = path.resolve(__dirname, 'worker-crash-workspace');
	const codeFilename = path.join(workspaceFolder, 'crash.css');
	const stateFilePath = path.join(workspaceFolder, '.stylelint-worker-crash-state.json');
	const runnerOptions: RunnerOptions = { rules: { customizations: [] } };

	const createLintRequest = () => ({
		workspaceFolder,
		runnerOptions,
		options: {
			code: 'a { color: #fff; }',
			codeFilename,
			config: {
				plugins: [pluginPath],
				rules: {
					[crashRuleName]: [
						true,
						{ maxCrashes: 3, stateFile: '.stylelint-worker-crash-state.json' },
					],
				},
			},
		} as stylelint.LinterOptions,
	});

	let service: WorkspaceStylelintService;

	beforeEach(async () => {
		service = createTestContainerInstance().resolve(WorkspaceStylelintService);
		await fs.rm(stateFilePath, { force: true });
	});

	afterEach(async () => {
		service.disposeAll();
		await fs.rm(stateFilePath, { force: true });
	});

	test('recovers once workspace activity resets suppressed workers', async () => {
		await expect(service.lint(createLintRequest())).rejects.toBeInstanceOf(
			StylelintWorkerCrashedError,
		);
		await expect(service.lint(createLintRequest())).rejects.toBeInstanceOf(
			StylelintWorkerCrashedError,
		);

		const unavailable = (await service
			.lint(createLintRequest())
			.catch((error) => error)) as StylelintWorkerUnavailableError;

		expect(unavailable).toBeInstanceOf(StylelintWorkerUnavailableError);
		expect(unavailable.notifyUser).toBe(true);

		const throttled = (await service
			.lint(createLintRequest())
			.catch((error) => error)) as StylelintWorkerUnavailableError;

		expect(throttled).toBeInstanceOf(StylelintWorkerUnavailableError);
		expect(throttled.notifyUser).toBe(false);

		service.notifyWorkspaceActivity(workspaceFolder);

		const result = await service.lint(createLintRequest());

		if (!result) {
			throw new Error('Expected worker lint result after crash recovery');
		}

		const warning = result.linterResult.results[0]?.warnings[0];

		expect(warning?.text).toContain('Worker recovered after 4 attempts');
		expect(warning?.rule).toBe(crashRuleName);
	}, 20000);
});

describe('StylelintRunner with auto-fix', () => {
	test('auto-fix should work properly if configs are defined', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
		const result = await runner.lintDocument(
			createDocument(null, 'css', 'a\n{\ncolor:#ffffff;\n}'),
			{
				config: { rules: { 'color-hex-length': 'short' } },
				fix: true,
			},
		);

		expect(getFixedText(result)).toMatchSnapshot();
	});

	testOnVersion(
		'<17',
		'auto-fix should only work properly for syntax errors if no rules are defined',
		async () => {
			expect.assertions(1);
			const runner = resolveStylelintRunner();
			const result = await runner.lintDocument(createDocument('no-rules.css', 'css', 'a {'), {
				config: {},
				fix: true,
			});

			expect(getFixedText(result)).toBe('a {}');
		},
	);

	testOnVersion(
		'>=17',
		'auto-fix should only work properly for syntax errors if no rules are defined and fix mode is "lax"',
		async () => {
			expect.assertions(1);
			const runner = resolveStylelintRunner();
			const result = await runner.lintDocument(createDocument('no-rules.css', 'css', 'a {'), {
				config: {},
				fix: 'lax' as unknown as boolean, // fix: 'lax' is valid in stylelint >=17
			});

			expect(getFixedText(result)).toBe('a {}');
		},
	);

	testOnVersion(
		'>=17',
		'auto-fix should not fix anything if no rules are defined and fix mode is "strict"',
		async () => {
			expect.assertions(1);
			const runner = resolveStylelintRunner();
			const result = await runner.lintDocument(createDocument('no-rules.css', 'css', 'a {'), {
				config: {},
				fix: 'strict' as unknown as boolean, // fix: 'strict' is valid in stylelint >=17
			});

			expect(getFixedText(result)).toBeUndefined();
		},
	);

	test('JS file auto-fix should not change the content if no rules are defined', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
		const result = await runner.lintDocument(createDocument('no-rules.js', 'javascript', '"a"'), {
			customSyntax: 'postcss-styled-syntax',
			config: {},
			fix: true,
		});

		expect(getFixedText(result)).toBe('"a"');
	});

	test('auto-fix should ignore if the file matches the ignoreFiles', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
		const result = await runner.lintDocument(
			createDocument('should-be-ignored.js', 'javascript', '"a"'),
			{
				customSyntax: 'postcss-styled-syntax',
				config: {
					rules: {},
					ignoreFiles: '**/*-ignored.js',
				},
				fix: true,
			},
		);

		expect(getFixedText(result)).toBeUndefined();
	});

	testOnVersion('<17', 'auto-fix should work if there are syntax errors in css', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
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

		expect(getFixedText(result)).toMatchSnapshot();
	});

	testOnVersion(
		'>=17',
		'auto-fix should by default not fix anything if there are syntax errors in css',
		async () => {
			expect.assertions(1);
			const runner = resolveStylelintRunner();
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

			expect(getFixedText(result)).toBeUndefined();
		},
	);

	testOnVersion(
		'>=17',
		'auto-fix should fix syntax errors if there are syntax errors in css and fix mode is "lax"',
		async () => {
			expect.assertions(1);
			const runner = resolveStylelintRunner();
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
					fix: 'lax' as unknown as boolean, // fix: 'lax' is valid in stylelint >=17
				},
			);

			expect(getFixedText(result)).toMatchSnapshot();
		},
	);

	test('auto-fix should ignore if there is syntax errors in scss', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
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

		expect(getFixedText(result)).toBeUndefined();
	});

	test('auto-fix should work if there are errors that cannot be auto-fixed', async () => {
		const runner = resolveStylelintRunner();
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

		expect(snapshotLintDiagnostics(result)).toMatchSnapshot();
		expect(getFixedText(result)).toMatchSnapshot();
	});
});

describe('StylelintRunner with customSyntax', () => {
	test('should work properly if customSyntax is defined', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
		const result = await runner.lintDocument(
			createDocument('test.css', 'css', 'a\n  color:#ffffff'),
			{
				config: { rules: { 'color-hex-length': 'short' } },
				customSyntax: 'postcss-sass',
			},
		);

		expect(snapshotLintDiagnostics(result)).toMatchSnapshot();
	});

	test('auto-fix should work properly if customSyntax is defined', async () => {
		expect.assertions(2);
		const runner = resolveStylelintRunner();

		try {
			const result = await runner.lintDocument(
				createDocument('test.css', 'css', 'a\n  color:#ffffff'),
				{
					config: { rules: { 'color-hex-length': 'short' } },
					customSyntax: 'postcss-sass',
					fix: true,
				},
			);

			expect(snapshotLintDiagnostics(result)).toMatchSnapshot();
			expect(getFixedText(result)).toMatchSnapshot();
		} catch (e) {
			console.error(e);
		}
	});
});

describe('StylelintRunner with reportDescriptionlessDisables', () => {
	test('should work properly if reportDescriptionlessDisables is true', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
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

		expect(snapshotLintDiagnostics(result)).toMatchSnapshot();
	});
});

describe('StylelintRunner with reportNeedlessDisables', () => {
	test('should work properly if reportNeedlessDisables is true', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
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

		expect(snapshotLintDiagnostics(result)).toMatchSnapshot();
	});
});

describe('StylelintRunner with reportInvalidScopeDisables', () => {
	test('should work properly if reportInvalidScopeDisables is true', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
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

		expect(snapshotLintDiagnostics(result)).toMatchSnapshot();
	});
});

describe('StylelintRunner with stylelintPath', () => {
	test('should work properly if stylelintPath is defined', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
		const result = await runner.lintDocument(
			createDocument('test.css', 'css', 'a{\n  color:#y3}'),
			{
				config: { rules: { 'color-no-invalid-hex': [true] } },
			},
			{
				stylelintPath: path.resolve(__dirname, '../../../node_modules/stylelint'),
			},
		);

		expect(snapshotLintDiagnostics(result)).toMatchSnapshot();
	});

	test('should work properly if custom path is defined in stylelintPath', async () => {
		expect.assertions(1);
		const runner = resolveStylelintRunner();
		const result = await runner.lintDocument(
			createDocument('test.css', 'css', 'a{\n  color:#y3}'),
			{
				config: { rules: { 'color-no-invalid-hex': [true] } },
			},
			{
				stylelintPath: require.resolve('./fake-stylelint'),
			},
		);

		expect(snapshotLintDiagnostics(result)).toMatchSnapshot();
	});
});
