jest.mock('../../../utils/documents');
jest.mock('../../../utils/packages');
jest.mock('fs/promises');
jest.mock('path');

import fs from 'fs/promises';
import path from 'path';
import type LSP from 'vscode-languageserver-protocol';
import type winston from 'winston';
import { getWorkspaceFolder } from '../../../utils/documents';
import { findPackageRoot } from '../../../utils/packages';
import { OldStylelintWarningModule } from '../old-stylelint-warning';
import type { LanguageServerOptions, LanguageServerModuleConstructorParameters } from '../../types';

const mockedFS = fs as tests.mocks.FSPromisesModule;
const mockedPath = path as tests.mocks.PathModule;
const mockedGetWorkspaceFolder = getWorkspaceFolder as jest.MockedFunction<
	typeof getWorkspaceFolder
>;
const mockedFindPackageRoot = findPackageRoot as jest.MockedFunction<typeof findPackageRoot>;

const mockOptions: LanguageServerOptions = {
	codeAction: {
		disableRuleComment: {
			location: 'separateLine',
		},
	},
	packageManager: 'npm',
	validate: [],
	snippet: [],
};

const mockContext = {
	connection: {
		window: {
			showWarningMessage: jest.fn(),
			showDocument: jest.fn(),
		},
	},
	documents: { onDidOpen: jest.fn() },
	getOptions: jest.fn(async () => mockOptions),
	displayError: jest.fn(),
	resolveStylelint: jest.fn(),
};

const mockLogger = {
	debug: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
} as unknown as jest.Mocked<winston.Logger>;

const getParams = (passLogger = false) =>
	({
		context: mockContext,
		logger: passLogger ? mockLogger : undefined,
	} as unknown as LanguageServerModuleConstructorParameters);

describe('OldStylelintWarningModule', () => {
	beforeEach(() => {
		mockedPath.__mockPlatform('posix');
		mockOptions.validate = [];
		jest.clearAllMocks();
	});

	test('should be constructable', () => {
		expect(() => new OldStylelintWarningModule(getParams())).not.toThrow();
	});

	test('onDidRegisterHandlers should register an onDidOpen handler', () => {
		const module = new OldStylelintWarningModule(getParams());

		module.onDidRegisterHandlers();

		expect(mockContext.documents.onDidOpen).toHaveBeenCalledTimes(1);
		expect(mockContext.documents.onDidOpen).toHaveBeenCalledWith(expect.any(Function));
	});

	test('if document language ID is not in options, should not warn', async () => {
		mockOptions.validate = ['baz'];

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({ capabilities: {} } as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).not.toHaveBeenCalled();
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Document should not be validated, ignoring',
			{ uri: 'foo', language: 'bar' },
		);
	});

	test('if document is not part of a workspace, should not warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue(undefined);
		mockOptions.validate = ['bar'];

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({ capabilities: {} } as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).not.toHaveBeenCalled();
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Document not part of a workspace, ignoring',
			{ uri: 'foo' },
		);
	});

	test('if document has already been checked, should not warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockOptions.validate = ['bar'];

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({ capabilities: {} } as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Document has already been checked, ignoring',
			{ uri: 'foo' },
		);
	});

	test('if Stylelint package root cannot be determined, should not warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue(undefined);
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {},
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockOptions.validate = ['bar'];

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({ capabilities: {} } as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Stylelint package root not found', {
			uri: 'foo',
		});
	});

	test('if Stylelint package manifest cannot be read, should not warn', async () => {
		const error = new Error('foo');

		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {},
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockOptions.validate = ['bar'];
		mockedFS.readFile.mockRejectedValue(error);

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({ capabilities: {} } as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Stylelint package manifest could not be read',
			{ uri: 'foo', manifestPath: '/path/node_modules/stylelint/package.json', error },
		);
	});

	test('if Stylelint package manifest is malformed, should not warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {},
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockOptions.validate = ['bar'];
		mockedFS.readFile.mockResolvedValue('{');

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({ capabilities: {} } as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Stylelint package manifest could not be read',
			{
				uri: 'foo',
				manifestPath: '/path/node_modules/stylelint/package.json',
				error: expect.any(Error),
			},
		);
	});

	test('if Stylelint package manifest does not contain a version, should not warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {},
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockOptions.validate = ['bar'];
		mockedFS.readFile.mockResolvedValue('{}');

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({ capabilities: {} } as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
	});

	test('if Stylelint version cannot be parsed, should not warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {},
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockOptions.validate = ['bar'];
		mockedFS.readFile.mockResolvedValue('{"version": "foo"}');

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({ capabilities: {} } as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Stylelint version could not be parsed', {
			uri: 'foo',
			version: 'foo',
			error: expect.any(Error),
		});
	});

	test('if Stylelint version is 14.x or greater, should not warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {},
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockOptions.validate = ['bar'];
		mockedFS.readFile.mockResolvedValue('{"version": "14.0.0"}');

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({ capabilities: {} } as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
	});

	test('if Stylelint version is 14.x with a label, should not warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {},
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockOptions.validate = ['bar'];
		mockedFS.readFile.mockResolvedValue('{"version": "14.0.0-sdk"}');

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({ capabilities: {} } as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
	});

	test('without openDocument support, if Stylelint version is less than 14.x, should warn and provide link to migration guide', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {},
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockOptions.validate = ['bar'];
		mockedFS.readFile.mockResolvedValue('{"version": "13.0.0"}');

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({ capabilities: {} } as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage.mock.calls[0]).toMatchSnapshot();
		expect(mockContext.connection.window.showDocument).not.toHaveBeenCalled();
	});

	test("with openDocument support, if Stylelint version is less than 14.x and user doesn't click button, should warn but not open URL", async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {},
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockOptions.validate = ['bar'];
		mockContext.connection.window.showWarningMessage.mockResolvedValue(undefined);
		mockedFS.readFile.mockResolvedValue('{"version": "13.0.0"}');

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({
			capabilities: {
				window: {
					showDocument: { support: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showDocument).not.toHaveBeenCalled();
	});

	test('with openDocument support, if Stylelint version is less than 14.x and user clicks button, should warn and open URL', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {},
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockOptions.validate = ['bar'];
		mockContext.connection.window.showWarningMessage.mockResolvedValue({
			title: 'Open migration guide',
		});
		mockContext.connection.window.showDocument.mockResolvedValue({
			success: true,
		});
		mockedFS.readFile.mockResolvedValue('{"version": "13.0.0"}');

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({
			capabilities: {
				window: {
					showDocument: { support: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showDocument).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showDocument.mock.calls[0]).toMatchSnapshot();
		expect(mockLogger.warn).not.toHaveBeenCalledWith('Failed to open migration guide');
	});

	test('with openDocument support, if Stylelint version is less than 14.x and user clicks button, but fails to open URL, should warn and log', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {},
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockOptions.validate = ['bar'];
		mockContext.connection.window.showWarningMessage.mockResolvedValue({
			title: 'Open migration guide',
		});
		mockContext.connection.window.showDocument.mockResolvedValue({
			success: false,
		});
		mockedFS.readFile.mockResolvedValue('{"version": "13.0.0"}');

		const module = new OldStylelintWarningModule(getParams(true));

		module.onInitialize({
			capabilities: {
				window: {
					showDocument: { support: true },
				},
			},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: { uri: 'foo', languageId: 'bar' },
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showDocument).toHaveBeenCalledTimes(1);
		expect(mockLogger.warn).toHaveBeenCalledWith('Failed to open migration guide');
	});
});
