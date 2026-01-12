import path from 'path';
import type stylelint from 'stylelint';
import { beforeEach, describe, expect, test, vi, type MockedFunction } from 'vitest';
import type { RunnerOptions } from '../../../stylelint/types.js';
import type { PackageRootService } from '../package-root.service.js';
import { StylelintOptionsService } from '../stylelint-options.service';

const fakeUri = {
	parse: (value: string) => ({ fsPath: value, root: '/' }),
} as unknown as typeof import('vscode-uri').URI;

const createBuilder = (packageRootFinder: PackageRootService) =>
	new StylelintOptionsService(
		path.posix,
		(child, parent) => {
			if (parent === '/') {
				return child.startsWith('/');
			}

			const normalizedParent = parent.endsWith('/') ? parent : `${parent}/`;

			return child === parent || child.startsWith(normalizedParent);
		},
		fakeUri,
		packageRootFinder,
		(value) => value ?? undefined,
	);

describe('buildStylelintOptions', () => {
	type FindPackageRoot = PackageRootService['find'];
	let findPackageRoot: MockedFunction<FindPackageRoot>;
	let packageRootFinder: PackageRootService;
	let builder: StylelintOptionsService;

	beforeEach(() => {
		findPackageRoot = vi.fn(async () => undefined);
		packageRootFinder = {
			find: findPackageRoot,
		} as unknown as PackageRootService;
		builder = createBuilder(packageRootFinder);
	});

	const build = (
		uri: string,
		workspaceFolder?: string,
		baseOptions?: Partial<stylelint.LinterOptions>,
		runnerOptions?: RunnerOptions,
	) => builder.build(uri, workspaceFolder, baseOptions, runnerOptions);

	test('with no options, should only set cwd', async () => {
		const result = await build('/path/to/file.css', '/path');

		expect(result).toEqual({ cwd: '/path' });
	});

	test('should only override cwd if document is in workspace', async () => {
		const result1 = await build('/path/to/file.css', '/path', {
			cwd: '/other',
		});

		expect(result1).toEqual({ cwd: '/other' });

		const result2 = await build('/path/to/file.css', '/workspace', {
			cwd: '/other',
		});

		expect(result2).toEqual({ cwd: '/workspace' });
	});

	test('with no cwd or workspace folder, should set cwd to package root', async () => {
		findPackageRoot.mockResolvedValueOnce('/path');

		const result = await build('/path/to/file.css');

		expect(result).toEqual({ cwd: '/path' });
	});

	test('with no cwd, when document is not in workspace, should set cwd to package root', async () => {
		findPackageRoot.mockResolvedValueOnce('/path');

		const result = await build('/path/to/file.css', '/workspace');

		expect(result).toEqual({ cwd: '/path' });
	});

	test('with no cwd, package root, or workspace, should set cwd to document folder', async () => {
		findPackageRoot.mockResolvedValueOnce(undefined);

		const result = await build('/path/to/file.css');

		expect(result).toEqual({ cwd: '/path/to' });
	});

	test('with no options or document FS path, should only set cwd to workspace folder', async () => {
		findPackageRoot.mockResolvedValueOnce('/path');

		const result = await build('', '/workspace');

		expect(result).toEqual({ cwd: '/workspace' });
	});

	test('with only base options, should not override base options except cwd', async () => {
		findPackageRoot.mockResolvedValueOnce('/path');

		const options: stylelint.LinterOptions = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: false,
			ignorePath: '/.stylelintignore',
			reportDescriptionlessDisables: false,
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await build('/path/to/file.css', '/path', options);

		expect(result).toEqual({
			...options,
			cwd: '/path',
		});
	});

	test('with runner options, should override base options', async () => {
		findPackageRoot.mockResolvedValueOnce('/path');

		const options: stylelint.LinterOptions = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			cwd: '/other',
			reportDescriptionlessDisables: true,
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		const runnerOptions: RunnerOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '/workspace/stylelint.config.js',
			configBasedir: '/workspace',
			customSyntax: 'postcss-html',
			ignoreDisables: false,
			reportDescriptionlessDisables: false,
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await build('/workspace/file.css', '/path', options, runnerOptions);

		expect(result).toEqual({
			...options,
			...runnerOptions,
		});
	});

	test('with runner options and workspace, should override and replace ${workspaceFolder} in paths', async () => {
		findPackageRoot.mockResolvedValueOnce('/workspace');

		const options: stylelint.LinterOptions = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportDescriptionlessDisables: true,
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		const runnerOptions: RunnerOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '${workspaceFolder}/stylelint.config.js',
			configBasedir: '/workspace',
			customSyntax: '${workspaceFolder}/postcss-html',
			ignoreDisables: false,
			reportDescriptionlessDisables: false,
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await build('/workspace/file.css', '/workspace', options, runnerOptions);

		expect(result).toEqual({
			...options,
			...runnerOptions,
			configFile: '/workspace/stylelint.config.js',
			configBasedir: '/workspace',
			customSyntax: '/workspace/postcss-html',
			cwd: '/workspace',
		});
	});

	test('with runner options and no workspace, should not replace ${workspaceFolder} in paths', async () => {
		findPackageRoot.mockResolvedValueOnce('/workspace');

		const options: stylelint.LinterOptions = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			cwd: '/other',
			reportDescriptionlessDisables: true,
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		const runnerOptions: RunnerOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '${workspaceFolder}/stylelint.config.js',
			configBasedir: '/workspace',
			customSyntax: '${workspaceFolder}/postcss-html',
			ignoreDisables: false,
			reportDescriptionlessDisables: false,
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await build('/workspace/file.css', undefined, options, runnerOptions);

		expect(result).toEqual({
			...options,
			...runnerOptions,
			configBasedir: '/workspace',
			cwd: '/other',
		});
	});

	test('with runner options and workspace, should make configBasedir absolute if it is relative', async () => {
		findPackageRoot.mockResolvedValueOnce('/workspace');

		const options: stylelint.LinterOptions = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportDescriptionlessDisables: true,
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		const runnerOptions: RunnerOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '/workspace/stylelint.config.js',
			configBasedir: './base',
			customSyntax: '/workspace/postcss-html',
			ignoreDisables: false,
			reportDescriptionlessDisables: false,
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await build('/workspace/file.css', '/workspace', options, runnerOptions);

		expect(result).toEqual({
			...options,
			...runnerOptions,
			configBasedir: '/workspace/base',
			ignorePath: '/.stylelintignore',
			cwd: '/workspace',
		});
	});

	test('with runner options and no workspace, should not make configBasedir absolute if it is relative', async () => {
		findPackageRoot.mockResolvedValueOnce('/workspace');

		const options: stylelint.LinterOptions = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportDescriptionlessDisables: true,
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		const runnerOptions: RunnerOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '/workspace/stylelint.config.js',
			configBasedir: './base',
			customSyntax: '/workspace/postcss-html',
			ignoreDisables: false,
			reportDescriptionlessDisables: false,
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await build('/workspace/file.css', undefined, options, runnerOptions);

		expect(result).toEqual({
			...options,
			...runnerOptions,
			configBasedir: 'base',
			ignorePath: '/.stylelintignore',
			cwd: '/workspace',
		});
	});
});
