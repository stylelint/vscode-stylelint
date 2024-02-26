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
import * as packages from '../../packages/index';
import { buildStylelintOptions } from '../build-stylelint-options';

const mockedPath = path as tests.mocks.PathModule;
const mockedPackages = packages as jest.Mocked<typeof packages>;

mockedPath.__mockPlatform('posix');

describe('buildStylelintOptions', () => {
	beforeEach(() => {
		mockedPackages.findPackageRoot.mockReset();
	});

	test('with no options, should only set ignore path', async () => {
		const result = await buildStylelintOptions('/path/to/file.css', '/path');

		expect(result).toEqual({ ignorePath: '/path/.stylelintignore' });
	});

	test('should only override ignore path if document is in workspace', async () => {
		const result1 = await buildStylelintOptions('/path/to/file.css', '/path', {
			ignorePath: './stylelintignore',
		});

		expect(result1).toEqual({ ignorePath: '/path/.stylelintignore' });

		const result2 = await buildStylelintOptions('/path/to/file.css', '/workspace', {
			ignorePath: './stylelintignore',
		});

		expect(result2).toEqual({ ignorePath: './stylelintignore' });
	});

	test('with no ignore path or workspace folder, should set ignore path to package root', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

		const result = await buildStylelintOptions('/path/to/file.css');

		expect(result).toEqual({ ignorePath: '/path/.stylelintignore' });
	});

	test('with no ignore path, when document is not in workspace, should set ignore path to package root', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

		const result = await buildStylelintOptions('/path/to/file.css', '/workspace');

		expect(result).toEqual({ ignorePath: '/path/.stylelintignore' });
	});

	test('with no ignore path, package root, or workspace, should set ignore path to URI root', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce(undefined);

		const result = await buildStylelintOptions('/path/to/file.css');

		expect(result).toEqual({ ignorePath: '/.stylelintignore' });
	});

	test('with no options or document FS path, should not set any options', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

		const result = await buildStylelintOptions('', '/workspace');

		expect(result).toEqual({});
	});

	test('with only base options, should not override base options except ignore path', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

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

		const result = await buildStylelintOptions('/path/to/file.css', '/path', options);

		expect(result).toEqual({ ...options, ignorePath: '/path/.stylelintignore' });
	});

	test('with runner options, should override base options', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

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
			configBasedir: '/workspace',
			customSyntax: 'postcss-html',
			ignoreDisables: false,
			reportDescriptionlessDisables: false,
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
		});
	});

	test('with runner options and workspace, should override and replace ${workspaceFolder} in paths', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/workspace');

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
			ignorePath: '/workspace/.stylelintignore',
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
			ignorePath: '/.stylelintignore',
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
			ignorePath: '/workspace/.stylelintignore',
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
			ignorePath: '/.stylelintignore',
		});
	});
});
