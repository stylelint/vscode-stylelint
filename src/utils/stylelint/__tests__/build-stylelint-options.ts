jest.mock('path');
jest.mock('vscode-uri', () => ({
	URI: {
		parse: jest.fn((uri) => ({ fsPath: uri, root: '/' })),
	},
}));
jest.mock('../../packages');

import path from 'path';
import type stylelint from 'stylelint';
import type { RunnerOptions } from '../types';
import * as packages from '../../packages';
import { buildStylelintOptions } from '../build-stylelint-options';

const mockedPath = path as tests.mocks.PathModule;
const mockedPackages = packages as jest.Mocked<typeof packages>;

mockedPath.__mockPlatform('posix');

describe('buildStylelintOptions', () => {
	beforeEach(() => {
		mockedPackages.findPackageRoot.mockReset();
	});

	test('with no options, should only set ignore path and cwd', async () => {
		const result = await buildStylelintOptions('/path/to/file.css', '/path');

		expect(result).toEqual({ ignorePath: '/path/.stylelintignore', cwd: '/path' });
	});

	test('when document is not in workspace, should set cwd to package root', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

		const result = await buildStylelintOptions('/path/to/file.css', '/workspace');

		expect(result).toEqual({ ignorePath: '/path/.stylelintignore', cwd: '/path' });
	});

	test('with no workspace folder, should set cwd to package root', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

		const result = await buildStylelintOptions('/path/to/file.css');

		expect(result).toEqual({ ignorePath: '/path/.stylelintignore', cwd: '/path' });
	});

	test('with no package root, or workspace, should set cwd to URI root', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce(undefined);

		const result = await buildStylelintOptions('/path/to/file.css');

		expect(result).toEqual({ ignorePath: '/.stylelintignore', cwd: '/' });
	});

	test('with no ignore path or workspace folder, should set ignore path to package root', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

		const result = await buildStylelintOptions('/path/to/file.css');

		expect(result).toEqual({ ignorePath: '/path/.stylelintignore', cwd: '/path' });
	});

	test('with no ignore path, when document is not in workspace, should set ignore path to package root', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

		const result = await buildStylelintOptions('/path/to/file.css', '/workspace');

		expect(result).toEqual({ ignorePath: '/path/.stylelintignore', cwd: '/path' });
	});

	test('with no ignore path, package root, or workspace, should set ignore path to URI root', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce(undefined);

		const result = await buildStylelintOptions('/path/to/file.css');

		expect(result).toEqual({ ignorePath: '/.stylelintignore', cwd: '/' }); //?
	});

	test('with no options or document FS path, should not set any options', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

		const result = await buildStylelintOptions('', '/workspace');

		expect(result).toEqual({});
	});

	test('with no options or an untitled document, should not set any options', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

		const result = await buildStylelintOptions('Untitled-1', '/workspace');

		expect(result).toEqual({});
	});

	test('with only base options, should not override base options except cwd', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

		const options: stylelint.LinterOptions = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: false,
			ignorePath: '/path/to/.stylelintignore',
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await buildStylelintOptions('/path/to/file.css', '/path', options);

		expect(result).toEqual({ ...options, ignorePath: '/path/to/.stylelintignore', cwd: '/path' });
	});

	test('with runner options, should override base options and set cwd', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

		const options: stylelint.LinterOptions = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		const runnerOptions: RunnerOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '/workspace/stylelint.config.js',
			configBasedir: '/workspace',
			customSyntax: 'postcss-html',
			ignoreDisables: false,
			ignorePath: '/custom/path/to/.stylelintignore',
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await buildStylelintOptions(
			'/workspace/file.css',
			'/path',
			options,
			runnerOptions,
		);

		expect(result).toEqual({
			...options,
			...runnerOptions,
			cwd: '/path',
		});
	});

	test('with runner options and workspace, should override and replace ${workspaceFolder} in paths and set cwd to workspaceFolder', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/workspace');

		const options: stylelint.LinterOptions = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		const runnerOptions: RunnerOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '${workspaceFolder}/stylelint.config.js',
			configBasedir: '/workspace',
			customSyntax: '${workspaceFolder}/postcss-html',
			ignoreDisables: false,
			ignorePath: '${workspaceFolder}/custom/path/to/.stylelintignore',
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await buildStylelintOptions(
			'/workspace/file.css',
			'/workspace',
			options,
			runnerOptions,
		);

		expect(result).toEqual({
			...options,
			...runnerOptions,
			configFile: '/workspace/stylelint.config.js',
			configBasedir: '/workspace',
			customSyntax: '/workspace/postcss-html',
			ignorePath: '/workspace/custom/path/to/.stylelintignore',
			cwd: '/workspace',
		});
	});

	test('with runner options and no workspace, should not replace ${workspaceFolder} in paths', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/workspace');

		const options: stylelint.LinterOptions = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		const runnerOptions: RunnerOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '${workspaceFolder}/stylelint.config.js',
			configBasedir: '/workspace',
			customSyntax: '${workspaceFolder}/postcss-html',
			ignoreDisables: false,
			ignorePath: '${workspaceFolder}/custom/path/to/.stylelintignore',
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await buildStylelintOptions(
			'/workspace/file.css',
			undefined,
			options,
			runnerOptions,
		);

		expect(result).toEqual({
			...options,
			...runnerOptions,
			configBasedir: '/workspace',
			cwd: '/workspace',
		});
	});

	test('with runner options and workspace, should make configBasedir absolute if it is relative', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/workspace');

		const options: stylelint.LinterOptions = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		const runnerOptions: RunnerOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '/workspace/stylelint.config.js',
			configBasedir: './base',
			customSyntax: '/workspace/postcss-html',
			ignoreDisables: false,
			ignorePath: '/custom/path/to/.stylelintignore',
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await buildStylelintOptions(
			'/workspace/file.css',
			'/workspace',
			options,
			runnerOptions,
		);

		expect(result).toEqual({
			...options,
			...runnerOptions,
			configBasedir: '/workspace/base',
			cwd: '/workspace',
		});
	});

	test('with runner options and no workspace, should not make configBasedir absolute if it is relative', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/workspace');

		const options: stylelint.LinterOptions = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		const runnerOptions: RunnerOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '/workspace/stylelint.config.js',
			configBasedir: './base',
			customSyntax: '/workspace/postcss-html',
			ignoreDisables: false,
			ignorePath: '/custom/path/to/.stylelintignore',
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await buildStylelintOptions(
			'/workspace/file.css',
			undefined,
			options,
			runnerOptions,
		);

		expect(result).toEqual({
			...options,
			...runnerOptions,
			configBasedir: 'base',
			cwd: '/workspace',
		});
	});
});
