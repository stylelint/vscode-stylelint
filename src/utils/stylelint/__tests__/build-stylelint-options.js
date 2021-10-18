jest.mock('path');
jest.mock('vscode-uri', () => ({
	URI: {
		parse: jest.fn((uri) => ({ fsPath: uri, root: '/' })),
	},
}));
jest.mock('../../packages');

const mockedPackages = /** @type {jest.Mocked<typeof import('../../packages')>} */ (
	require('../../packages')
);

const mockedPath = /** @type {tests.mocks.PathModule} */ (require('path'));

mockedPath.__mockPlatform('posix');

const { buildStylelintOptions } = require('../build-stylelint-options');

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

		/** @type {imports.stylelint.LinterOptions} */
		const options = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: false,
			ignorePath: '/.stylelintignore',
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await buildStylelintOptions('/path/to/file.css', '/path', options);

		expect(result).toEqual({ ...options, ignorePath: '/path/.stylelintignore' });
	});

	test('with extension options, should override base options', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/path');

		/** @type {imports.stylelint.LinterOptions} */
		const options = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		/** @type {ExtensionOptions} */
		const extensionOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '/workspace/stylelint.config.js',
			configBasedir: '/workspace',
			customSyntax: 'postcss-html',
			ignoreDisables: false,
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await buildStylelintOptions(
			'/workspace/file.css',
			'/path',
			options,
			extensionOptions,
		);

		expect(result).toEqual({
			...options,
			...extensionOptions,
		});
	});

	test('with extension options and workspace, should override and replace ${workspaceFolder} in paths', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/workspace');

		/** @type {imports.stylelint.LinterOptions} */
		const options = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		/** @type {ExtensionOptions} */
		const extensionOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '${workspaceFolder}/stylelint.config.js',
			configBasedir: '/workspace',
			customSyntax: '${workspaceFolder}/postcss-html',
			ignoreDisables: false,
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await buildStylelintOptions(
			'/workspace/file.css',
			'/workspace',
			options,
			extensionOptions,
		);

		expect(result).toEqual({
			...options,
			...extensionOptions,
			configFile: '/workspace/stylelint.config.js',
			configBasedir: '/workspace',
			customSyntax: '/workspace/postcss-html',
			ignorePath: '/workspace/.stylelintignore',
		});
	});

	test('with extension options and no workspace, should not replace ${workspaceFolder} in paths', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/workspace');

		/** @type {imports.stylelint.LinterOptions} */
		const options = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		/** @type {ExtensionOptions} */
		const extensionOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '${workspaceFolder}/stylelint.config.js',
			configBasedir: '/workspace',
			customSyntax: '${workspaceFolder}/postcss-html',
			ignoreDisables: false,
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await buildStylelintOptions(
			'/workspace/file.css',
			undefined,
			options,
			extensionOptions,
		);

		expect(result).toEqual({
			...options,
			...extensionOptions,
			configBasedir: '/workspace',
			ignorePath: '/.stylelintignore',
		});
	});

	test('with extension options and workspace, should make configBasedir absolute if it is relative', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/workspace');

		/** @type {imports.stylelint.LinterOptions} */
		const options = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		/** @type {ExtensionOptions} */
		const extensionOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '/workspace/stylelint.config.js',
			configBasedir: './base',
			customSyntax: '/workspace/postcss-html',
			ignoreDisables: false,
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await buildStylelintOptions(
			'/workspace/file.css',
			'/workspace',
			options,
			extensionOptions,
		);

		expect(result).toEqual({
			...options,
			...extensionOptions,
			configBasedir: '/workspace/base',
			ignorePath: '/workspace/.stylelintignore',
		});
	});

	test('with extension options and no workspace, should not make configBasedir absolute if it is relative', async () => {
		mockedPackages.findPackageRoot.mockResolvedValueOnce('/workspace');

		/** @type {imports.stylelint.LinterOptions} */
		const options = {
			config: {},
			configFile: '/path/stylelint.config.js',
			configBasedir: '/path',
			customSyntax: 'postcss-scss',
			ignoreDisables: true,
			ignorePath: '/.stylelintignore',
			reportNeedlessDisables: true,
			reportInvalidScopeDisables: true,
		};

		/** @type {ExtensionOptions} */
		const extensionOptions = {
			config: { rules: { 'block-no-empty': true } },
			configFile: '/workspace/stylelint.config.js',
			configBasedir: './base',
			customSyntax: '/workspace/postcss-html',
			ignoreDisables: false,
			reportNeedlessDisables: false,
			reportInvalidScopeDisables: false,
		};

		const result = await buildStylelintOptions(
			'/workspace/file.css',
			undefined,
			options,
			extensionOptions,
		);

		expect(result).toEqual({
			...options,
			...extensionOptions,
			configBasedir: 'base',
			ignorePath: '/.stylelintignore',
		});
	});
});
