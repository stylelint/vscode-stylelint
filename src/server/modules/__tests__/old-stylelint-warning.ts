jest.mock('../../../utils/documents');
jest.mock('../../../utils/packages');
jest.mock('fs/promises');
jest.mock('path');

import fs from 'fs/promises';
import path from 'path';
import type LSP from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getWorkspaceFolder } from '../../../utils/documents/index';
import { findPackageRoot } from '../../../utils/packages/index';
import { OldStylelintWarningModule } from '../old-stylelint-warning';
import { Stylelint } from '../../../utils/stylelint/index';

const mockedFS = fs as tests.mocks.FSPromisesModule;
const mockedPath = path as tests.mocks.PathModule;
const mockedGetWorkspaceFolder = getWorkspaceFolder as jest.MockedFunction<
	typeof getWorkspaceFolder
>;
const mockedFindPackageRoot = findPackageRoot as jest.MockedFunction<typeof findPackageRoot>;

let mockContext: ReturnType<typeof serverMocks.getContext>;
let mockLogger: ReturnType<typeof serverMocks.getLogger>;

describe('OldStylelintWarningModule', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedPath.__mockPlatform('posix');
		mockContext = serverMocks.getContext();
		mockLogger = serverMocks.getLogger();
		mockContext.__options.validate = [];
	});

	test('should be constructable', () => {
		expect(() => new OldStylelintWarningModule({ context: mockContext.__typed() })).not.toThrow();
	});

	test('onDidRegisterHandlers should register an onDidOpen handler', () => {
		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
		});

		module.onDidRegisterHandlers();

		expect(mockContext.documents.onDidOpen).toHaveBeenCalledTimes(1);
		expect(mockContext.documents.onDidOpen).toHaveBeenCalledWith(expect.any(Function));
	});

	test('if document is not part of a workspace, should not warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue(undefined);
		mockContext.__options.validate = ['bar'];

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onInitialize({
			capabilities: {},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
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
		mockContext.__options.validate = ['bar'];

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onInitialize({
			capabilities: {},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const document = TextDocument.create('foo', 'bar', 1, 'a {}');
		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({ document });
		await handler({ document });

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
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['bar'];

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onInitialize({
			capabilities: {},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith('Stylelint package root not found', {
			uri: 'foo',
		});
	});

	test('if Stylelint package root is not in workspace, should not warn', async () => {
		const error = new Error('foo');

		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/usr/local/lib/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['bar'];
		mockedFS.readFile.mockRejectedValue(error);

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onInitialize({
			capabilities: {},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Stylelint package root is not inside the workspace',
			{ uri: 'foo' },
		);
	});

	test('if Stylelint package manifest cannot be read, should not warn', async () => {
		const error = new Error('foo');

		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['bar'];
		mockedFS.readFile.mockRejectedValue(error);

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onInitialize({
			capabilities: {},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
		expect(mockLogger.debug).toHaveBeenLastCalledWith(
			'Stylelint package manifest could not be read',
			{
				uri: 'foo',
				manifestPath: '/path/node_modules/stylelint/package.json',
				error,
			},
		);
	});

	test('if Stylelint package manifest is malformed, should not warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['bar'];
		mockedFS.readFile.mockResolvedValue('{');

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onInitialize({
			capabilities: {},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
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
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['bar'];
		mockedFS.readFile.mockResolvedValue('{}');

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onInitialize({
			capabilities: {},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
	});

	test('if Stylelint version cannot be parsed, should not warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['bar'];
		mockedFS.readFile.mockResolvedValue('{"version": "foo"}');

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onInitialize({
			capabilities: {},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
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
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['bar'];
		mockedFS.readFile.mockResolvedValue('{"version": "14.0.0"}');

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onInitialize({
			capabilities: {},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
	});

	test('if Stylelint version is 14.x with a label, should not warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['bar'];
		mockedFS.readFile.mockResolvedValue('{"version": "14.0.0-sdk"}');

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onInitialize({
			capabilities: {},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).not.toHaveBeenCalled();
	});

	test('without openDocument support, if Stylelint version is less than 14.x, should warn and provide link to migration guide', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['bar'];
		mockedFS.readFile.mockResolvedValue('{"version": "13.0.0"}');

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onInitialize({
			capabilities: {},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
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
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['bar'];
		mockContext.connection.window.showWarningMessage.mockResolvedValue(undefined);
		mockedFS.readFile.mockResolvedValue('{"version": "13.0.0"}');

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

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
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showDocument).not.toHaveBeenCalled();
	});

	test('with openDocument support, if Stylelint version is less than 14.x and user clicks button, should warn and open URL', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['bar'];
		mockContext.connection.window.showWarningMessage.mockResolvedValue({
			title: 'Open migration guide',
		});
		mockContext.connection.window.showDocument.mockResolvedValue({
			success: true,
		});
		mockedFS.readFile.mockResolvedValue('{"version": "13.0.0"}');

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

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
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
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
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['bar'];
		mockContext.connection.window.showWarningMessage.mockResolvedValue({
			title: 'Open migration guide',
		});
		mockContext.connection.window.showDocument.mockResolvedValue({
			success: false,
		});
		mockedFS.readFile.mockResolvedValue('{"version": "13.0.0"}');

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

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
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showDocument).toHaveBeenCalledTimes(1);
		expect(mockLogger.warn).toHaveBeenCalledWith('Failed to open migration guide');
	});

	test('if document language ID is not in options, should warn', async () => {
		mockedGetWorkspaceFolder.mockResolvedValue('/path');
		mockedFindPackageRoot.mockResolvedValue('/path/node_modules/stylelint');
		mockContext.resolveStylelint.mockResolvedValue({
			stylelint: {} as unknown as Stylelint,
			resolvedPath: '/path/node_modules/stylelint',
		});
		mockContext.__options.validate = ['baz'];

		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onInitialize({
			capabilities: {},
		} as unknown as LSP.InitializeParams);

		module.onDidRegisterHandlers();

		const handler = mockContext.documents.onDidOpen.mock.calls[0][0];

		await handler({
			document: TextDocument.create('foo', 'bar', 1, 'a {}'),
		});

		expect(mockContext.resolveStylelint).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showWarningMessage).toHaveBeenCalledTimes(1);
		expect(mockContext.connection.window.showDocument).not.toHaveBeenCalled();
	});

	it('should be disposable', () => {
		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		expect(module).toHaveProperty('dispose');
		expect(module.dispose).toBeInstanceOf(Function);
	});

	it('should dispose all handler registrations when disposed', () => {
		const module = new OldStylelintWarningModule({
			context: mockContext.__typed(),
			logger: mockLogger,
		});

		module.onDidRegisterHandlers();
		module.dispose();

		const disposable = mockContext.documents.onDidOpen.mock.results[0].value;

		expect(disposable.dispose).toHaveBeenCalledTimes(1);
	});
});
